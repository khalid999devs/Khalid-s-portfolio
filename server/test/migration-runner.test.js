'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  acquireMigrationLock,
  applyPendingMigrations,
  executeWithCleanup,
  inspectMigrationStatus,
  parseArguments,
  run,
} = require('../scripts/migrate');

const MIGRATIONS = [
  '20260722000000-first.js',
  '20260722000001-second.js',
];

const createMigrationDirectory = () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'portfolio-migrations-')
  );
  MIGRATIONS.forEach((name) => fs.writeFileSync(path.join(directory, name), ''));
  return directory;
};

const createDatabase = ({ applied = [], metadataExists = true } = {}) => {
  const calls = [];
  const state = {
    applied: [...applied],
    metadataExists,
  };
  const queryInterface = {
    async createTable(name, definition, options) {
      calls.push(['createTable', name, definition, options]);
      state.metadataExists = true;
    },
    async showAllTables() {
      return state.metadataExists ? ['SequelizeMeta'] : [];
    },
  };
  const sequelize = {
    async authenticate() {
      calls.push(['authenticate']);
    },
    async close() {
      calls.push(['close']);
    },
    connectionManager: {
      async getConnection() {
        calls.push(['getConnection']);
        return {
          id: 'migration-lock-connection',
          // Mirror the mysql2 driver surface. Advisory locks are session
          // scoped, so the runner must issue them here rather than through
          // `sequelize.query()`, which ignores `options.connection`.
          promise() {
            return {
              async query(sql) {
                if (sql.includes('GET_LOCK')) {
                  calls.push(['getLock', 'migration-lock-connection']);
                  return [[{ acquired: 1 }]];
                }
                if (sql.includes('RELEASE_LOCK')) {
                  calls.push(['releaseLock', 'migration-lock-connection']);
                  return [[{ released: 1 }]];
                }
                throw new Error(`Unexpected lock SQL: ${sql}`);
              },
            };
          },
        };
      },
      async releaseConnection(connection) {
        calls.push(['releaseConnection', connection.id]);
      },
    },
    getQueryInterface() {
      return queryInterface;
    },
    async query(sql, options = {}) {
      if (sql.includes('GET_LOCK') || sql.includes('RELEASE_LOCK')) {
        // Sequelize 6 ignores `options.connection`, so a lock statement
        // arriving here would run on an arbitrary pooled session and could
        // not be released. Fail loudly instead of simulating support.
        throw new Error(
          'Advisory lock statements must run on the reserved connection'
        );
      }
      if (sql.startsWith('SELECT')) {
        return state.applied.map((name) => ({ name }));
      }
      if (sql.startsWith('INSERT')) {
        state.applied.push(options.replacements.name);
        calls.push(['insert', options.replacements.name]);
        return [];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  return {
    calls,
    db: {
      Sequelize: {
        STRING: (length) => ({ key: 'STRING', options: { length } }),
      },
      sequelize,
    },
    state,
  };
};

test('migration arguments are explicit and environment-bounded', () => {
  assert.deepEqual(parseArguments(['up']), {
    command: 'up',
    environment: undefined,
  });
  assert.deepEqual(parseArguments(['status', '--env', 'production']), {
    command: 'status',
    environment: 'production',
  });
  assert.throws(() => parseArguments(['down']), /Usage/u);
  assert.throws(
    () => parseArguments(['up', '--env', 'staging']),
    /Usage/u
  );
  assert.throws(() => parseArguments(['up', '--force']), /Usage/u);
});

test('fresh migration run creates metadata and records migrations in order', async (t) => {
  const directory = createMigrationDirectory();
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const { calls, db, state } = createDatabase({ metadataExists: false });
  const executed = [];

  const result = await applyPendingMigrations(db, {
    migrationsDirectory: directory,
    loadMigration: (migrationPath) => ({
      up: async () => executed.push(path.basename(migrationPath)),
    }),
  });

  assert.deepEqual(result, MIGRATIONS);
  assert.deepEqual(executed, MIGRATIONS);
  assert.deepEqual(state.applied, MIGRATIONS);
  assert.equal(calls.filter(([name]) => name === 'createTable').length, 1);
  const metadataDefinition = calls.find(
    ([name]) => name === 'createTable'
  )[2];
  assert.equal(metadataDefinition.name.primaryKey, true);
  assert.equal(
    Object.hasOwn(metadataDefinition.name, 'unique'),
    false
  );
  assert.equal(
    calls.find(([name]) => name === 'createTable')[3].engine,
    'InnoDB'
  );
  assert.deepEqual(
    calls
      .filter(([name]) =>
        ['getLock', 'releaseLock', 'releaseConnection'].includes(name)
      )
      .map(([name]) => name),
    ['getLock', 'releaseLock', 'releaseConnection']
  );
});

test('migration runner applies only pending files and rejects unknown history', async (t) => {
  const directory = createMigrationDirectory();
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const current = createDatabase({ applied: [MIGRATIONS[0]] });
  const executed = [];

  const result = await applyPendingMigrations(current.db, {
    migrationsDirectory: directory,
    loadMigration: (migrationPath) => ({
      up: async () => executed.push(path.basename(migrationPath)),
    }),
  });
  assert.deepEqual(result, [MIGRATIONS[1]]);
  assert.deepEqual(executed, [MIGRATIONS[1]]);

  const unexpected = createDatabase({ applied: ['20990101000000-newer.js'] });
  await assert.rejects(
    applyPendingMigrations(unexpected.db, {
      migrationsDirectory: directory,
    }),
    /newer or unrecognized/u
  );
});

test('migration runner rejects a known but non-prefix history before executing', async (t) => {
  const directory = createMigrationDirectory();
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const { db } = createDatabase({ applied: [MIGRATIONS[1]] });
  const executed = [];

  await assert.rejects(
    () =>
      applyPendingMigrations(db, {
        migrationsDirectory: directory,
        loadMigration: (migrationPath) => ({
          up: async () => executed.push(path.basename(migrationPath)),
        }),
      }),
    /not a contiguous release prefix/u
  );
  assert.deepEqual(executed, []);

  await assert.rejects(
    () =>
      inspectMigrationStatus(db.sequelize, {
        migrationsDirectory: directory,
      }),
    /not a contiguous release prefix/u
  );
});

test('failed migration is never marked as applied', async (t) => {
  const directory = createMigrationDirectory();
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const { db, state } = createDatabase();

  await assert.rejects(
    applyPendingMigrations(db, {
      migrationsDirectory: directory,
      loadMigration: () => ({
        up: async () => {
          throw new Error('DDL failed');
        },
      }),
    }),
    /DDL failed/u
  );
  assert.deepEqual(state.applied, []);
});

test('migration lock is connection-bound, bounded, and always released', async () => {
  const { calls, db } = createDatabase();

  const release = await acquireMigrationLock(db.sequelize, {
    lockName: 'test-lock',
    timeoutSeconds: 7,
  });
  await release();

  assert.deepEqual(
    calls.filter(([name]) =>
      ['getConnection', 'getLock', 'releaseLock', 'releaseConnection'].includes(
        name
      )
    ),
    [
      ['getConnection'],
      ['getLock', 'migration-lock-connection'],
      ['releaseLock', 'migration-lock-connection'],
      ['releaseConnection', 'migration-lock-connection'],
    ]
  );
});

test('cleanup failures are reported without hiding the primary operation error', async () => {
  const primaryError = new Error('migration operation failed');
  const cleanupError = new Error('lock cleanup failed');

  await assert.rejects(
    () =>
      executeWithCleanup(
        async () => {
          throw primaryError;
        },
        async () => {
          throw cleanupError;
        },
        'releasing test lock failed'
      ),
    (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.equal(error.cause, primaryError);
      assert.deepEqual(error.errors, [primaryError, cleanupError]);
      assert.match(error.message, /migration operation failed/u);
      assert.match(error.message, /lock cleanup failed/u);
      return true;
    }
  );
});

test('concurrent migration runs serialize and apply each migration once', async (t) => {
  const directory = createMigrationDirectory();
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const { db, state } = createDatabase({ metadataExists: false });
  const executed = [];
  let lockTail = Promise.resolve();

  const acquireLock = async () => {
    const previousLock = lockTail;
    let releaseOwnLock;
    lockTail = new Promise((resolve) => {
      releaseOwnLock = resolve;
    });
    await previousLock;
    return async () => releaseOwnLock();
  };

  const options = {
    acquireLock,
    migrationsDirectory: directory,
    loadMigration: (migrationPath) => ({
      up: async () => {
        executed.push(path.basename(migrationPath));
        await Promise.resolve();
      },
    }),
  };

  const [firstResult, secondResult] = await Promise.all([
    applyPendingMigrations(db, options),
    applyPendingMigrations(db, options),
  ]);

  assert.deepEqual(firstResult, MIGRATIONS);
  assert.deepEqual(secondResult, []);
  assert.deepEqual(executed, MIGRATIONS);
  assert.deepEqual(state.applied, MIGRATIONS);
});

test('status is read-only when migration metadata has not been initialized', async (t) => {
  const directory = createMigrationDirectory();
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const { calls, db } = createDatabase({ metadataExists: false });

  const statuses = await inspectMigrationStatus(db.sequelize, {
    migrationsDirectory: directory,
  });
  assert.deepEqual(
    statuses,
    MIGRATIONS.map((name) => ({ name, state: 'down' }))
  );
  assert.equal(calls.some(([name]) => name === 'createTable'), false);
});

test('CLI wrapper always closes the database and prints stable status', async () => {
  const { calls, db } = createDatabase({
    applied: ['20260722000000-baseline-schema.js'],
  });
  const output = [];

  const statuses = await run({
    arguments_: ['status'],
    loadDatabase: () => db,
    output: { write: (value) => output.push(value) },
  });

  assert.equal(statuses.length, 5);
  assert.match(output.join(''), /\[up\] 20260722000000-baseline-schema\.js/u);
  assert.match(
    output.join(''),
    /\[down\] 20260726000000-ensure-transactional-engines\.js/u
  );
  assert.match(
    output.join(''),
    /\[down\] 20260726005000-normalize-charset-collation\.js/u
  );
  assert.match(
    output.join(''),
    /\[down\] 20260726010000-schema-and-project-data-preflight\.js/u
  );
  assert.match(
    output.join(''),
    /\[down\] 20260726020000-add-contact-reply-delivery-state\.js/u
  );
  assert.equal(calls.filter(([name]) => name === 'close').length, 1);
});
