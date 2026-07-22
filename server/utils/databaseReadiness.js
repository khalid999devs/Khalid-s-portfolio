'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getRounds } = require('bcryptjs');
const { QueryTypes } = require('sequelize');

const DEFAULT_MIGRATIONS_DIRECTORY = path.resolve(
  __dirname,
  '../migrations'
);
const MIGRATION_FILE_PATTERN = /^\d{14}[\w-]*\.js$/;
const MIGRATION_METADATA_TABLE = 'SequelizeMeta';

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
    'SELECT `id` FROM `settings` ORDER BY `id` ASC LIMIT 2',
    { type: QueryTypes.SELECT }
  );

  if (rows.length > 1) {
    throw new Error(
      'Settings inventory is unsafe; reconcile legacy rows so at most one settings record remains'
    );
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

  if (missingMigrations.length) {
    throw new Error(
      'Database has pending migrations; run npm run db:migrate. Pending: ' +
        missingMigrations.join(', ')
    );
  }

  if (unexpectedMigrations.length) {
    throw new Error(
      'Database migration history is newer or unrecognized for this release: ' +
        unexpectedMigrations.join(', ')
    );
  }

  return {
    appliedMigrationCount: migrationRows.length,
    expectedMigrationCount: expectedMigrations.length,
  };
};

module.exports = {
  DEFAULT_MIGRATIONS_DIRECTORY,
  MIGRATION_METADATA_TABLE,
  assertAdminAccountReady,
  assertDatabaseReady,
  assertSettingsSingletonReady,
  findMissingMigrations,
  findUnexpectedMigrations,
  listMigrationFiles,
  normalizeTableName,
};
