'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { hashSync } = require('bcryptjs');

const { startServer } = require('../index');
const {
  assertAdminAccountReady,
  assertDatabaseReady,
  assertSettingsSingletonReady,
  findMissingMigrations,
  listMigrationFiles,
} = require('../utils/databaseReadiness');

const baselineMigration = '20260722000000-baseline-schema.js';

const createSequelizeStub = ({ applied = [], tables = [] } = {}) => {
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
      return applied.map((name) => ({ name }));
    },
  };
};

test('migration manifest contains the formal schema baseline', () => {
  assert.deepEqual(listMigrationFiles(), [baselineMigration]);
  assert.deepEqual(
    findMissingMigrations([baselineMigration], [baselineMigration]),
    []
  );
});

test('database readiness authenticates and accepts a fully migrated schema', async () => {
  const sequelize = createSequelizeStub({
    applied: [baselineMigration],
    tables: [{ tableName: 'SequelizeMeta' }],
  });

  const result = await assertDatabaseReady(sequelize);

  assert.deepEqual(result, {
    appliedMigrationCount: 1,
    expectedMigrationCount: 1,
  });
  assert.equal(sequelize.calls[0], 'authenticate');
  assert.equal(sequelize.calls[1], 'showAllTables');
  assert.match(sequelize.calls[2].sql, /FROM `SequelizeMeta`/u);
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

  await assert.rejects(
    () => assertDatabaseReady(sequelize),
    new RegExp(`Pending: ${baselineMigration}`)
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

test('production settings readiness permits zero or one row and rejects legacy duplicates', async () => {
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
    await assertSettingsSingletonReady(sequelizeWithRows([{ id: 4 }])),
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
        return [{ name: baselineMigration }];
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
