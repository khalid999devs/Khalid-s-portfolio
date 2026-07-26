'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getRounds } = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const {
  parseStoredTechnologies,
} = require('./technologySettings');

const DEFAULT_MIGRATIONS_DIRECTORY = path.resolve(
  __dirname,
  '../migrations'
);
const MIGRATION_FILE_PATTERN = /^\d{14}[\w-]*\.js$/;
const MIGRATION_METADATA_TABLE = 'SequelizeMeta';
const TRANSACTIONAL_TABLES = Object.freeze([
  MIGRATION_METADATA_TABLE,
  'admins',
  'contacts',
  'projects',
  'settings',
]);

const normalizeTableName = (table) => {
  if (typeof table === 'string') return table;
  return table?.tableName || table?.table_name || table?.name;
};

const listMigrationFiles = (
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY
) =>
  fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort();

const findMissingMigrations = (expectedMigrations, appliedMigrations) => {
  const applied = new Set(appliedMigrations);
  return expectedMigrations.filter((migration) => !applied.has(migration));
};

const findUnexpectedMigrations = (expectedMigrations, appliedMigrations) => {
  const expected = new Set(expectedMigrations);
  return appliedMigrations.filter((migration) => !expected.has(migration));
};

const assertMigrationHistoryIsPrefix = (
  expectedMigrations,
  appliedMigrations
) => {
  const firstMismatch = appliedMigrations.findIndex(
    (migration, index) => expectedMigrations[index] !== migration
  );
  if (firstMismatch !== -1) {
    throw new Error(
      'Database migration history is not a contiguous release prefix; ' +
        `expected ${expectedMigrations[firstMismatch] || 'no migration'} at ` +
        `position ${firstMismatch + 1}, found ${appliedMigrations[firstMismatch]}`
    );
  }
};

const assertTransactionalTablesReady = async (sequelize) => {
  const rows = await sequelize.query(
    'SELECT `TABLE_NAME` AS `tableName`, `ENGINE` AS `engine` ' +
      'FROM `information_schema`.`TABLES` ' +
      'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (:tableNames)',
    {
      replacements: { tableNames: TRANSACTIONAL_TABLES },
      type: QueryTypes.SELECT,
    }
  );
  const engines = new Map(
    rows.map((row) => [
      String(row.tableName),
      String(row.engine || '').toLowerCase(),
    ])
  );
  const unsafeTables = TRANSACTIONAL_TABLES.filter(
    (tableName) => engines.get(tableName) !== 'innodb'
  );

  if (unsafeTables.length) {
    throw new Error(
      'Database tables are missing or non-transactional; run npm run db:migrate. Unsafe: ' +
        unsafeTables.join(', ')
    );
  }
};

const assertAdminAccountReady = async (
  sequelize,
  expectedUserName,
  expectedBcryptCost
) => {
  if (typeof expectedUserName !== 'string' || !expectedUserName.trim()) {
    throw new Error('The expected administrator identity is not configured');
  }

  const rows = await sequelize.query(
    'SELECT `id`, `userName`, `password`, `sessionVersion` ' +
      'FROM `admins` ORDER BY `id` ASC LIMIT 2',
    { type: QueryTypes.SELECT }
  );

  let bcryptCost;
  try {
    bcryptCost = getRounds(rows[0]?.password || '');
  } catch (_error) {
    bcryptCost = 0;
  }

  if (
    rows.length !== 1 ||
    rows[0].userName !== expectedUserName.trim() ||
    !Number.isSafeInteger(Number(rows[0].sessionVersion)) ||
    Number(rows[0].sessionVersion) < 1 ||
    !Number.isInteger(expectedBcryptCost) ||
    bcryptCost !== expectedBcryptCost
  ) {
    throw new Error(
      'Administrator inventory or credential generation is unsafe; rotate the one expected account'
    );
  }

  return { adminId: rows[0].id };
};

const assertSettingsSingletonReady = async (sequelize) => {
  const rows = await sequelize.query(
    'SELECT `id`, `technologies` FROM `settings` ORDER BY `id` ASC LIMIT 2',
    { type: QueryTypes.SELECT }
  );

  if (rows.length > 1) {
    throw new Error(
      'Settings inventory is unsafe; reconcile legacy rows so at most one settings record remains'
    );
  }

  if (rows.length === 1) {
    try {
      parseStoredTechnologies(rows[0].technologies);
    } catch (_error) {
      throw new Error(
        'Settings technologies data is unsafe; reconcile the stored value before production startup'
      );
    }
  }

  return { settingsId: rows[0]?.id ?? null };
};

const assertDatabaseReady = async (
  sequelize,
  { migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY } = {}
) => {
  await sequelize.authenticate();

  const expectedMigrations = listMigrationFiles(migrationsDirectory);
  if (expectedMigrations.length === 0) {
    throw new Error('No database migrations are available for this release');
  }

  const queryInterface = sequelize.getQueryInterface();
  const tableNames = (await queryInterface.showAllTables()).map(
    normalizeTableName
  );
  if (!tableNames.includes(MIGRATION_METADATA_TABLE)) {
    throw new Error(
      'Database migrations have not been initialized; run npm run db:migrate'
    );
  }

  const migrationRows = await sequelize.query(
    'SELECT `name` FROM `SequelizeMeta` ORDER BY `name` ASC',
    { type: QueryTypes.SELECT }
  );
  const missingMigrations = findMissingMigrations(
    expectedMigrations,
    migrationRows.map((row) => row.name)
  );
  const unexpectedMigrations = findUnexpectedMigrations(
    expectedMigrations,
    migrationRows.map((row) => row.name)
  );

  if (unexpectedMigrations.length) {
    throw new Error(
      'Database migration history is newer or unrecognized for this release: ' +
        unexpectedMigrations.join(', ')
    );
  }

  assertMigrationHistoryIsPrefix(
    expectedMigrations,
    migrationRows.map((row) => row.name)
  );

  if (missingMigrations.length) {
    throw new Error(
      'Database has pending migrations; run npm run db:migrate. Pending: ' +
        missingMigrations.join(', ')
    );
  }

  await assertTransactionalTablesReady(sequelize);

  return {
    appliedMigrationCount: migrationRows.length,
    expectedMigrationCount: expectedMigrations.length,
  };
};

module.exports = {
  DEFAULT_MIGRATIONS_DIRECTORY,
  MIGRATION_METADATA_TABLE,
  TRANSACTIONAL_TABLES,
  assertAdminAccountReady,
  assertDatabaseReady,
  assertMigrationHistoryIsPrefix,
  assertSettingsSingletonReady,
  assertTransactionalTablesReady,
  findMissingMigrations,
  findUnexpectedMigrations,
  listMigrationFiles,
  normalizeTableName,
};
