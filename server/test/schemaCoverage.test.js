'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

process.env.ADMIN_SECRET ||= 'test-admin-secret-that-is-long-enough-for-the-check';
process.env.COOKIE_SECRET ||= 'test-cookie-secret-that-is-long-enough-and-differs';
process.env.REMOTE_CLIENT_APP ||= 'http://localhost:5173';

/**
 * Every model must have a table some migration creates.
 *
 * This exists because `contacts` did not. The baseline migration never created
 * it, and nobody noticed for months: every database in use already had the
 * table, created once by the `sequelize.sync()` that used to run on boot. Once
 * sync was removed the gap was invisible everywhere except on a database that
 * had never seen it, which is precisely a fresh production deploy. The public
 * contact form would have answered 500 there while working in every
 * environment it was tested in.
 *
 * Reading the migration SQL as text rather than running it keeps this a unit
 * test with no database, so it runs in CI where there is no MySQL.
 */

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const migrationSql = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    .join('\n');

test('every model table is created by some migration', () => {
  const db = require('../models');
  const sql = migrationSql();

  const tables = Object.keys(db)
    .filter((key) => !['sequelize', 'Sequelize'].includes(key))
    .map((key) => String(db[key].getTableName()));

  assert.ok(tables.length > 0, 'expected at least one model');

  const missing = tables.filter((table) => {
    // Matches `CREATE TABLE x`, with or without IF NOT EXISTS and backticks.
    const pattern = new RegExp(
      `CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?\`?${table}\`?`,
      'i'
    );
    return !pattern.test(sql);
  });

  assert.deepEqual(
    missing,
    [],
    `No migration creates: ${missing.join(', ')}. A fresh database would be missing these.`
  );
});

test('migrations are ordered by their timestamp prefix', () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.js'));
  const prefixes = files.map((f) => f.split('-')[0]);

  for (const prefix of prefixes) {
    assert.match(prefix, /^\d{14}$/, `${prefix} is not a 14 digit timestamp`);
  }

  assert.deepEqual(
    [...prefixes].sort(),
    prefixes,
    'Migration filenames must sort into the order they should run in.'
  );
});

test('no migration uses a destructive statement', () => {
  const sql = migrationSql();

  // DROP TABLE / TRUNCATE in a forward migration means a deploy can silently
  // destroy production data. If one is ever genuinely needed it should be a
  // deliberate, reviewed exception rather than something that slips in.
  for (const forbidden of [/\bDROP\s+TABLE\b/i, /\bTRUNCATE\b/i, /\bDROP\s+DATABASE\b/i]) {
    assert.ok(
      !forbidden.test(sql),
      `A migration contains ${forbidden}. Forward migrations must not destroy data.`
    );
  }
});
