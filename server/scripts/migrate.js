#!/usr/bin/env node
'use strict';

/**
 * Ordered, recorded schema migrations.
 *
 * Replaces `db.sequelize.sync()` on boot, which made the live schema whatever
 * the models happened to say at the time, with no record of what had been
 * applied, no ordering, and no way to review a change before it ran.
 *
 *   npm run migrate           apply everything pending
 *   npm run migrate:status    list applied and pending, change nothing
 *
 * Migrations are applied in filename order, each inside a transaction, and
 * recorded in `schema_migrations`. A recorded migration is never re-run and
 * never edited -- a mistake is corrected by adding another migration.
 */

require('dotenv').config({ quiet: true });

const { readdirSync } = require('fs');
const { join } = require('path');
const { QueryTypes } = require('sequelize');
const db = require('../models');

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const LOCK_NAME = 'portfolio_schema_migration';
const LOCK_TIMEOUT_SECONDS = 30;

const listMigrations = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort();

const ensureBookkeepingTable = async () => {
  await db.sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const appliedMigrations = async () => {
  const rows = await db.sequelize.query(
    'SELECT name FROM schema_migrations ORDER BY name',
    { type: QueryTypes.SELECT }
  );
  return new Set(rows.map((row) => row.name));
};

/**
 * MySQL advisory locks are held by the *session* that took them. Sequelize's
 * `query({ connection })` option is silently ignored on v6, so passing a
 * reserved connection there runs the statement on an arbitrary pooled one --
 * the lock ends up on a different session than intended, RELEASE_LOCK fails,
 * and the reserved connection leaks. The lock statements therefore go straight
 * to the driver connection.
 */
const withMigrationLock = async (run) => {
  const connection = await db.sequelize.connectionManager.getConnection();
  const raw = connection.promise ? connection.promise() : connection;

  const [lockRows] = await raw.query('SELECT GET_LOCK(?, ?) AS acquired', [
    LOCK_NAME,
    LOCK_TIMEOUT_SECONDS,
  ]);
  if (lockRows[0]?.acquired !== 1) {
    db.sequelize.connectionManager.releaseConnection(connection);
    throw new Error(
      'Another migration run holds the lock. Wait for it to finish, then retry.'
    );
  }

  try {
    return await run();
  } finally {
    try {
      await raw.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
    } finally {
      db.sequelize.connectionManager.releaseConnection(connection);
    }
  }
};

const status = async () => {
  await ensureBookkeepingTable();
  const applied = await appliedMigrations();
  const all = listMigrations();

  for (const name of all) {
    process.stdout.write(`${applied.has(name) ? 'applied ' : 'pending '} ${name}\n`);
  }

  // A file recorded as applied but no longer present means history was edited.
  const orphaned = [...applied].filter((name) => !all.includes(name));
  if (orphaned.length > 0) {
    process.stdout.write(
      `\nRecorded but missing from disk: ${orphaned.join(', ')}\n` +
        'Migration history was rewritten. Investigate before applying anything else.\n'
    );
  }

  const pending = all.filter((name) => !applied.has(name));
  process.stdout.write(
    `\n${applied.size} applied, ${pending.length} pending.\n`
  );
  return pending;
};

const applyPending = async () => {
  await ensureBookkeepingTable();
  const applied = await appliedMigrations();
  const pending = listMigrations().filter((name) => !applied.has(name));

  if (pending.length === 0) {
    process.stdout.write('Nothing to apply.\n');
    return;
  }

  for (const name of pending) {
    const migration = require(join(MIGRATIONS_DIR, name));
    if (typeof migration.up !== 'function') {
      throw new Error(`${name} does not export an "up" function.`);
    }

    process.stdout.write(`applying ${name} ... `);
    // Each migration is atomic on its own. MySQL commits DDL implicitly, so a
    // migration mixing DDL and data changes cannot be fully rolled back -- keep
    // them separate, and keep each one small.
    await db.sequelize.transaction(async (transaction) => {
      await migration.up({
        sequelize: db.sequelize,
        queryInterface: db.sequelize.getQueryInterface(),
        transaction,
      });
      await db.sequelize.query(
        'INSERT INTO schema_migrations (name, applied_at) VALUES (?, NOW())',
        { replacements: [name], transaction }
      );
    });
    process.stdout.write('ok\n');
  }

  process.stdout.write(`\nApplied ${pending.length} migration(s).\n`);
};

const main = async () => {
  const command = process.argv[2] || 'up';
  if (!['up', 'status'].includes(command)) {
    process.stderr.write('Usage: node scripts/migrate.js <up|status>\n');
    process.exit(2);
  }

  await db.sequelize.authenticate();

  if (command === 'status') {
    await status();
    return;
  }

  await withMigrationLock(applyPending);
};

main()
  .then(async () => {
    await db.sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    process.stderr.write(`\nMigration failed: ${error.message}\n`);
    await db.sequelize.close().catch(() => {});
    process.exit(1);
  });
