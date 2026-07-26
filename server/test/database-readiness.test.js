'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { hashSync } = require('bcryptjs');

const { startServer } = require('../index');
const {
  assertAdminAccountReady,
  assertDatabaseReady,
  assertSettingsSingletonReady,
  assertTransactionalTablesReady,
  findMissingMigrations,
  listMigrationFiles,
} = require('../utils/databaseReadiness');

const baselineMigration = '20260722000000-baseline-schema.js';
const engineMigration =
  '20260726000000-ensure-transactional-engines.js';
const collationMigration =
  '20260726005000-normalize-charset-collation.js';
const schemaPreflightMigration =
  '20260726010000-schema-and-project-data-preflight.js';
const contactDeliveryMigration =
  '20260726020000-add-contact-reply-delivery-state.js';
const migrations = [
  baselineMigration,
  engineMigration,
  collationMigration,
  schemaPreflightMigration,
  contactDeliveryMigration,
];

const createSequelizeStub = ({
  applied = [],
  tables = [],
  tableEngines = {
    SequelizeMeta: 'InnoDB',
    admins: 'InnoDB',
    contacts: 'InnoDB',
    projects: 'InnoDB',
    settings: 'InnoDB',
  },
} = {}) => {
  const calls = [];
  return {
    calls,
    async authenticate() {
      calls.push('authenticate');
    },
    getQueryInterface() {
      return {
        async showAllTables() {
          calls.push('showAllTables');
          return tables;
        },
      };
    },
    async query(sql, options) {
      calls.push({ options, sql });
      if (sql.includes('information_schema')) {
        return Object.entries(tableEngines).map(([tableName, engine]) => ({
          engine,
          tableName,
        }));
      }
      return applied.map((name) => ({ name }));
    },
  };
};

test('migration manifest contains the formal schema baseline', () => {
  assert.deepEqual(listMigrationFiles(), migrations);
  assert.deepEqual(
    findMissingMigrations(migrations, migrations),
    []
  );
});

test('database readiness authenticates and accepts a fully migrated schema', async () => {
  const sequelize = createSequelizeStub({
    applied: migrations,
    tables: [{ tableName: 'SequelizeMeta' }],
  });

  const result = await assertDatabaseReady(sequelize);

  assert.deepEqual(result, {
    appliedMigrationCount: migrations.length,
    expectedMigrationCount: migrations.length,
  });
  assert.equal(sequelize.calls[0], 'authenticate');
  assert.equal(sequelize.calls[1], 'showAllTables');
  assert.match(sequelize.calls[2].sql, /FROM `SequelizeMeta`/u);
  assert.match(sequelize.calls[3].sql, /information_schema/u);
});

test('database readiness fails closed when migration metadata is absent', async () => {
  const sequelize = createSequelizeStub({ tables: ['admins'] });

  await assert.rejects(
    () => assertDatabaseReady(sequelize),
    /migrations have not been initialized; run npm run db:migrate/u
  );
  assert.deepEqual(sequelize.calls, ['authenticate', 'showAllTables']);
});

test('database readiness lists pending migrations without changing the schema', async () => {
  const sequelize = createSequelizeStub({ tables: ['SequelizeMeta'] });

  // Derived from the manifest so a new migration cannot silently drop out of
  // the pending list this assertion is meant to protect.
  const pendingList = migrations.join(', ').replace(/\./gu, '\\.');

  await assert.rejects(
    () => assertDatabaseReady(sequelize),
    new RegExp(`Pending: ${pendingList}`, 'u')
  );
});

test('database readiness rejects a migration history hole', async () => {
  const sequelize = createSequelizeStub({
    applied: [engineMigration],
    tables: ['SequelizeMeta'],
  });

  await assert.rejects(
    () => assertDatabaseReady(sequelize),
    /not a contiguous release prefix/u
  );
});

test('database readiness rejects a non-transactional application table', async () => {
  const sequelize = createSequelizeStub({
    applied: migrations,
    tables: ['SequelizeMeta'],
    tableEngines: {
      SequelizeMeta: 'InnoDB',
      admins: 'InnoDB',
      contacts: 'InnoDB',
      projects: 'MyISAM',
      settings: 'InnoDB',
    },
  });

  await assert.rejects(
    () => assertDatabaseReady(sequelize),
    /Unsafe: projects/u
  );
  await assert.rejects(
    () =>
      assertTransactionalTablesReady(
        createSequelizeStub({
          tableEngines: {},
        })
      ),
    /Unsafe: SequelizeMeta, admins, contacts, projects, settings/u
  );
});

test('production admin readiness requires one expected, rotated account at the exact bcrypt cost', async () => {
  const createAdminSequelize = (overrides = {}) => ({
    async query() {
      return [
        {
          id: 7,
          password: hashSync('safe test password', 10),
          sessionVersion: 1,
          userName: 'portfolio-admin',
          ...overrides,
        },
      ];
    },
  });

  assert.deepEqual(
    await assertAdminAccountReady(
      createAdminSequelize(),
      'portfolio-admin',
      10
    ),
    { adminId: 7 }
  );
  await assert.rejects(
    () =>
      assertAdminAccountReady(
        createAdminSequelize({
          password: hashSync('safe test password', 11),
        }),
        'portfolio-admin',
        10
      ),
    /credential generation is unsafe/u
  );
  await assert.rejects(
    () =>
      assertAdminAccountReady(
        createAdminSequelize({ sessionVersion: 0 }),
        'portfolio-admin',
        10
      ),
    /credential generation is unsafe/u
  );
});

test('production settings readiness permits zero or one valid row and rejects legacy duplicates', async () => {
  const sequelizeWithRows = (rows) => ({
    async query(sql) {
      assert.match(sql, /FROM `settings`/u);
      return rows;
    },
  });

  assert.deepEqual(
    await assertSettingsSingletonReady(sequelizeWithRows([])),
    { settingsId: null }
  );
  assert.deepEqual(
    await assertSettingsSingletonReady(
      sequelizeWithRows([
        {
          id: 4,
          technologies: '{"database":["MySQL"]}',
        },
      ])
    ),
    { settingsId: 4 }
  );
  await assert.rejects(
    () =>
      assertSettingsSingletonReady(
        sequelizeWithRows([{ id: 4 }, { id: 9 }])
      ),
    /Settings inventory is unsafe/u
  );
});

test('production settings readiness rejects data that the public settings route cannot serve', async () => {
  const sequelizeWithValue = (technologies) => ({
    async query(sql) {
      assert.match(
        sql,
        /SELECT `id`, `technologies` FROM `settings`/u
      );
      return [{ id: 4, technologies }];
    },
  });

  for (const technologies of [
    null,
    'not-json',
    '[]',
    '{"frontend":["React"," react "]}',
  ]) {
    await assert.rejects(
      () =>
        assertSettingsSingletonReady(
          sequelizeWithValue(technologies)
        ),
      /Settings technologies data is unsafe/u
    );
  }
});

test('production startup checks the settings singleton before opening HTTP', async () => {
  let closed = false;
  const sequelize = {
    async authenticate() {},
    async close() {
      closed = true;
    },
    getQueryInterface() {
      return {
        async showAllTables() {
          return ['SequelizeMeta', 'admins', 'settings'];
        },
      };
    },
    async query(sql) {
      if (sql.includes('FROM `SequelizeMeta`')) {
        return migrations.map((name) => ({ name }));
      }
      if (sql.includes('information_schema')) {
        return [
          'SequelizeMeta',
          'admins',
          'contacts',
          'projects',
          'settings',
        ].map((tableName) => ({ engine: 'InnoDB', tableName }));
      }
      if (sql.includes('FROM `admins`')) {
        return [
          {
            id: 1,
            password: hashSync('safe test password', 10),
            sessionVersion: 1,
            userName: 'portfolio-admin',
          },
        ];
      }
      if (sql.includes('FROM `settings`')) {
        return [{ id: 1 }, { id: 2 }];
      }
      throw new Error(`Unexpected test query: ${sql}`);
    },
  };

  await assert.rejects(
    () =>
      startServer({
        env: {
          ADMIN_PASSWORD_BCRYPT_COST: '10',
          ADMIN_SECRET: 'admin-secret-'.padEnd(40, 'a'),
          ADMIN_USERNAME: 'portfolio-admin',
          COOKIE_SECRET: 'cookie-secret-'.padEnd(40, 'b'),
          DATABASE_URL:
            'mysql://portfolio:password@db.internal:3306/portfolio',
          DB_SSL: 'true',
          NODE_ENV: 'production',
          REMOTE_CLIENT_APP: 'https://portfolio.example.test',
        },
        loadDatabase: () => ({ sequelize }),
        logger: { error() {}, log() {} },
      }),
    /Settings inventory is unsafe/u
  );
  assert.equal(closed, true);
});
