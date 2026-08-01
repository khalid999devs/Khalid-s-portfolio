'use strict';

/**
 * Database connection settings.
 *
 * Every value now comes from the environment. The previous version committed
 * the development credentials (`root`/`root`) into source control, set a
 * production pool of 2000 -- far beyond MySQL's default max_connections of 151,
 * so the pool would exhaust the database server rather than protect it -- and
 * configured no TLS at all, so production traffic including credentials crossed
 * the network in plaintext.
 */

const integer = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
};

const isProduction = process.env.NODE_ENV === 'production';

const host = process.env.DB_HOST || 'localhost';

/**
 * A database on this machine is reached over the loopback interface, so the
 * traffic never touches a network and there is no certificate to verify
 * against. Requiring TLS there is not a stronger position, it is an
 * unsatisfiable one: shared hosting puts MySQL on localhost with no CA, so the
 * rule below refused every value of DB_SSL and the server could not start in
 * production at all.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const isLoopback = LOOPBACK_HOSTS.has(host.trim().toLowerCase());

/** TLS is mandatory for a database reached across a network. */
const tlsRequired = isProduction && !isLoopback;

const pool = {
  max: integer('DB_POOL_MAX', 10, { min: 1, max: 100 }),
  min: integer('DB_POOL_MIN', 0, { min: 0, max: 50 }),
  acquire: integer('DB_POOL_ACQUIRE_MS', 30000, { min: 1000, max: 120000 }),
  idle: integer('DB_POOL_IDLE_MS', 10000, { min: 1000, max: 120000 }),
};

/**
 * TLS is mandatory for a production database across a network. `DB_SSL=false`
 * is honoured only where that does not apply, so a remote deployment cannot
 * quietly fall back to plaintext. DB_SSL=true still opts in anywhere.
 */
const ssl = (() => {
  const requested = process.env.DB_SSL;
  const enabled = tlsRequired ? requested !== 'false' : requested === 'true';

  if (!enabled) {
    if (tlsRequired) {
      throw new Error(
        `Refusing to connect to the database at ${host} without TLS. Set DB_SSL and DB_SSL_CA.`
      );
    }
    return undefined;
  }

  return {
    // Verification is the entire point. Disabling it leaves the connection
    // open to interception while still looking encrypted.
    rejectUnauthorized: true,
    ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
  };
})();

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  host,
  port: integer('DB_PORT', 3306, { min: 1, max: 65535 }),
  dialect: 'mysql',
  logging: false,
  pool,
  ...(ssl ? { dialectOptions: { ssl } } : {}),
};

module.exports = {
  development: base,
  test: {
    ...base,
    database:
      process.env.DB_NAME_TEST || `${process.env.DB_NAME || 'khalid_portfolio'}_test`,
  },
  production: base,
};
