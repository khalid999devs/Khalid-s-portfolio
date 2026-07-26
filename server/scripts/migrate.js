#!/usr/bin/env node
'use strict';

require('dotenv').config({ quiet: true });

const path = require('node:path');
const { QueryTypes } = require('sequelize');
const {
  DEFAULT_MIGRATIONS_DIRECTORY,
  MIGRATION_METADATA_TABLE,
  assertMigrationHistoryIsPrefix,
  findUnexpectedMigrations,
  listMigrationFiles,
  normalizeTableName,
} = require('../utils/databaseReadiness');
const { closeDatabaseConnection } = require('../utils/serverLifecycle');

const DATABASE_CLOSE_TIMEOUT_MS = 10_000;
const MIGRATION_LOCK_NAME = 'my_portfolio_schema_migrations_v1';
const MIGRATION_LOCK_TIMEOUT_SECONDS = 30;
const SUPPORTED_COMMANDS = new Set(['status', 'up']);
const SUPPORTED_ENVIRONMENTS = new Set([
  'development',
  'production',
  'test',
]);

const parseArguments = (arguments_) => {
  const [command, flag, environment] = arguments_;

  if (
    !SUPPORTED_COMMANDS.has(command) ||
    !(
      arguments_.length === 1 ||
      (arguments_.length === 3 &&
        flag === '--env' &&
        SUPPORTED_ENVIRONMENTS.has(environment))
    )
  ) {
    throw new Error(
      'Usage: node scripts/migrate.js <up|status> [--env development|test|production]'
    );
  }

  return { command, environment };
};

const executeWithCleanup = async (
  operation,
  cleanup,
  cleanupDescription
) => {
  let operationResult;
  let operationError;
  let cleanupError;

  try {
    operationResult = await operation();
  } catch (error) {
    operationError = error;
  }

  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }

  if (operationError && cleanupError) {
    throw new AggregateError(
      [operationError, cleanupError],
      `${operationError.message}; additionally, ${cleanupDescription}: ${cleanupError.message}`,
      { cause: operationError }
    );
  }
  if (operationError) throw operationError;
  if (cleanupError) throw cleanupError;
  return operationResult;
};

const hasMetadataTable = async (queryInterface) => {
  const tables = (await queryInterface.showAllTables()).map(normalizeTableName);
  return tables.includes(MIGRATION_METADATA_TABLE);
};

const ensureMetadataTable = async (queryInterface, SequelizeTypes) => {
  if (await hasMetadataTable(queryInterface)) return;

  await queryInterface.createTable(
    MIGRATION_METADATA_TABLE,
    {
      name: {
        allowNull: false,
        primaryKey: true,
        type: SequelizeTypes.STRING(255),
      },
    },
    {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    }
  );
};

const readAppliedMigrations = async (sequelize, metadataExists) => {
  if (!metadataExists) return [];

  const rows = await sequelize.query(
    'SELECT `name` FROM `SequelizeMeta` ORDER BY `name` ASC',
    { type: QueryTypes.SELECT }
  );
  return rows.map((row) => row.name);
};

// MySQL advisory locks are session-scoped: RELEASE_LOCK only succeeds on the
// exact session that ran GET_LOCK. Sequelize 6 silently ignores an
// `options.connection` passed to `sequelize.query()`, so lock statements must
// go straight to the reserved driver connection. Routing them through the pool
// instead lets GET_LOCK and RELEASE_LOCK land on different sessions, which
// fails the release and breaks the mutual exclusion this lock exists to provide.
const queryLockConnection = async (connection, sql, values) => {
  if (typeof connection?.promise !== 'function') {
    throw new Error('The database driver cannot provide a migration lock');
  }

  const [rows] = await connection.promise().query(sql, values);
  return rows;
};

const acquireMigrationLock = async (
  sequelize,
  {
    lockName = MIGRATION_LOCK_NAME,
    timeoutSeconds = MIGRATION_LOCK_TIMEOUT_SECONDS,
  } = {}
) => {
  const connectionManager = sequelize.connectionManager;
  if (
    !connectionManager ||
    typeof connectionManager.getConnection !== 'function' ||
    typeof connectionManager.releaseConnection !== 'function'
  ) {
    throw new Error('The database driver cannot provide a migration lock');
  }

  const connection = await connectionManager.getConnection();
  let lockAcquired = false;
  let connectionReleased = false;

  const releaseConnection = async () => {
    if (connectionReleased) return;
    connectionReleased = true;
    await connectionManager.releaseConnection(connection);
  };

  try {
    const rows = await queryLockConnection(
      connection,
      'SELECT GET_LOCK(?, ?) AS `acquired`',
      [lockName, timeoutSeconds]
    );

    lockAcquired = Number(rows[0]?.acquired) === 1;
    if (!lockAcquired) {
      throw new Error(
        `Could not acquire the database migration lock within ${timeoutSeconds} seconds`
      );
    }
  } catch (error) {
    return executeWithCleanup(
      async () => {
        throw error;
      },
      releaseConnection,
      'releasing the migration-lock connection failed'
    );
  }

  return async () => {
    if (!lockAcquired) return;
    lockAcquired = false;

    return executeWithCleanup(
      async () => {
        const rows = await queryLockConnection(
          connection,
          'SELECT RELEASE_LOCK(?) AS `released`',
          [lockName]
        );
        if (Number(rows[0]?.released) !== 1) {
          throw new Error('The database migration lock could not be released');
        }
      },
      releaseConnection,
      'releasing the migration-lock connection failed'
    );
  };
};

const inspectMigrationStatus = async (
  sequelize,
  { migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY } = {}
) => {
  await sequelize.authenticate();

  const expectedMigrations = listMigrationFiles(migrationsDirectory);
  if (expectedMigrations.length === 0) {
    throw new Error('No database migrations are available for this release');
  }

  const queryInterface = sequelize.getQueryInterface();
  const metadataExists = await hasMetadataTable(queryInterface);
  const appliedMigrations = await readAppliedMigrations(
    sequelize,
    metadataExists
  );
  const unexpectedMigrations = findUnexpectedMigrations(
    expectedMigrations,
    appliedMigrations
  );

  if (unexpectedMigrations.length) {
    throw new Error(
      'Database migration history is newer or unrecognized for this release: ' +
        unexpectedMigrations.join(', ')
    );
  }
  assertMigrationHistoryIsPrefix(expectedMigrations, appliedMigrations);

  const applied = new Set(appliedMigrations);
  return expectedMigrations.map((name) => ({
    name,
    state: applied.has(name) ? 'up' : 'down',
  }));
};

const applyPendingMigrations = async (
  db,
  {
    acquireLock = acquireMigrationLock,
    loadMigration = (migrationPath) => require(migrationPath),
    migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
  } = {}
) => {
  await db.sequelize.authenticate();

  const migrationNames = listMigrationFiles(migrationsDirectory);
  if (migrationNames.length === 0) {
    throw new Error('No database migrations are available for this release');
  }

  const releaseLock = await acquireLock(db.sequelize);
  return executeWithCleanup(
    async () => {
      const queryInterface = db.sequelize.getQueryInterface();
      await ensureMetadataTable(queryInterface, db.Sequelize);
      const appliedMigrations = await readAppliedMigrations(db.sequelize, true);
      const unexpectedMigrations = findUnexpectedMigrations(
        migrationNames,
        appliedMigrations
      );

      if (unexpectedMigrations.length) {
        throw new Error(
          'Database migration history is newer or unrecognized for this release: ' +
            unexpectedMigrations.join(', ')
        );
      }
      assertMigrationHistoryIsPrefix(migrationNames, appliedMigrations);

      const applied = new Set(appliedMigrations);
      const pendingMigrations = migrationNames.filter(
        (name) => !applied.has(name)
      );

      for (const name of pendingMigrations) {
        const migrationPath = path.join(migrationsDirectory, name);
        const migration = loadMigration(migrationPath);
        if (!migration || typeof migration.up !== 'function') {
          throw new Error(`Migration ${name} does not export an up function`);
        }

        await migration.up(queryInterface, db.Sequelize);
        await db.sequelize.query(
          'INSERT INTO `SequelizeMeta` (`name`) VALUES (:name)',
          { replacements: { name } }
        );
      }

      return pendingMigrations;
    },
    releaseLock,
    'releasing the migration lock failed'
  );
};

const run = async ({
  arguments_ = process.argv.slice(2),
  loadDatabase = () => require('../models'),
  output = process.stdout,
} = {}) => {
  const { command, environment } = parseArguments(arguments_);
  if (environment) process.env.NODE_ENV = environment;

  const db = loadDatabase();
  return executeWithCleanup(
    async () => {
      if (command === 'status') {
        const statuses = await inspectMigrationStatus(db.sequelize);
        statuses.forEach(({ name, state }) =>
          output.write(`[${state}] ${name}\n`)
        );
        return statuses;
      }

      const applied = await applyPendingMigrations(db);
      output.write(
        applied.length
          ? `Applied ${applied.length} migration(s).\n`
          : 'Database migrations are already current.\n'
      );
      return applied;
    },
    () =>
      closeDatabaseConnection(db.sequelize, DATABASE_CLOSE_TIMEOUT_MS),
    'closing the database connection failed'
  );
};

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`Database migration failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  acquireMigrationLock,
  applyPendingMigrations,
  executeWithCleanup,
  inspectMigrationStatus,
  parseArguments,
  run,
};
