'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sequelize = require('sequelize');

const migration = require('../migrations/20260726005000-normalize-charset-collation');

const { REQUIRED_TABLES, TARGET_COLLATION } = migration._private;

const createQueryInterface = ({
  initialCollations = {},
  mismatchedColumns = [],
} = {}) => {
  const calls = [];
  const collations = new Map(
    REQUIRED_TABLES.map((tableName) => [
      tableName,
      initialCollations[tableName] || TARGET_COLLATION,
    ])
  );
  const columns = new Map(
    mismatchedColumns.map(({ collation, columnName, tableName }) => [
      `${tableName}.${columnName}`,
      { collation, columnName, tableName },
    ])
  );

  return {
    calls,
    collations,
    columns,
    sequelize: {
      async query(sql, options = {}) {
        calls.push({ options, sql });

        if (sql.includes('`information_schema`.`COLUMNS`')) {
          return [...columns.values()].filter(
            (column) => column.collation !== TARGET_COLLATION
          );
        }
        if (sql.includes('`information_schema`.`TABLES`')) {
          return [...collations].map(([tableName, tableCollation]) => ({
            tableCollation,
            tableName,
          }));
        }

        const match = sql.match(
          /^ALTER TABLE `([^`]+)` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci$/u
        );
        if (!match) throw new Error(`Unexpected SQL: ${sql}`);

        collations.set(match[1], TARGET_COLLATION);
        columns.forEach((column, key) => {
          if (column.tableName === match[1]) {
            columns.set(key, { ...column, collation: TARGET_COLLATION });
          }
        });
        return [];
      },
    },
  };
};

const alterStatements = (queryInterface) =>
  queryInterface.calls
    .filter(({ sql }) => sql.startsWith('ALTER TABLE'))
    .map(({ sql }) => sql);

test('collation migration converts adopted tables that use a legacy collation', async () => {
  // MySQL 8 creates databases as utf8mb4_0900_ai_ci by default, so an adopted
  // legacy schema reaches this migration mismatched.
  const queryInterface = createQueryInterface({
    initialCollations: {
      admins: 'utf8mb4_0900_ai_ci',
      projects: 'utf8mb4_0900_ai_ci',
    },
  });

  await migration.up(queryInterface, Sequelize);

  assert.deepEqual(alterStatements(queryInterface), [
    'ALTER TABLE `admins` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    'ALTER TABLE `projects` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  ]);
  assert.equal(queryInterface.collations.get('admins'), TARGET_COLLATION);
  assert.equal(queryInterface.collations.get('projects'), TARGET_COLLATION);
});

test('collation migration converts a table whose columns drifted alone', async () => {
  // A table default can already be correct while an individual column still
  // carries a legacy collation from an older column-level definition.
  const queryInterface = createQueryInterface({
    mismatchedColumns: [
      {
        collation: 'utf8mb4_general_ci',
        columnName: 'title',
        tableName: 'projects',
      },
    ],
  });

  await migration.up(queryInterface, Sequelize);

  assert.deepEqual(alterStatements(queryInterface), [
    'ALTER TABLE `projects` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  ]);
});

test('collation migration is a no-op on an already normalized schema', async () => {
  const queryInterface = createQueryInterface();

  await migration.up(queryInterface, Sequelize);

  assert.deepEqual(alterStatements(queryInterface), []);
});

test('collation migration fails closed when the table inventory is incomplete', async () => {
  const queryInterface = createQueryInterface();
  queryInterface.collations.delete('projects');

  await assert.rejects(
    () => migration.up(queryInterface, Sequelize),
    /missing tables: projects/u
  );
  assert.deepEqual(alterStatements(queryInterface), []);
});

test('collation migration never restores a mixed-collation schema', async () => {
  await assert.rejects(() => migration.down(), /intentionally irreversible/u);
});
