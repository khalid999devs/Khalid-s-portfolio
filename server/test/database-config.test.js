const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const configPath = path.resolve(__dirname, '../config/config.js');

const loadConfigInChild = (environment) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ['-e', `console.log(JSON.stringify(require(${JSON.stringify(configPath)})))`],
      {
        encoding: 'utf8',
        env: {
          NODE_ENV: 'test',
          PATH: process.env.PATH,
          ...environment,
        },
      }
    )
  );

test('production database pool is conservative and environment-driven', () => {
  const config = loadConfigInChild({
    DB_HOST: 'db.internal',
    DB_NAME: 'portfolio',
    DB_PASS: 'secret',
    DB_POOL_MAX: '24',
    DB_PORT: '3307',
    DB_USER: 'portfolio-user',
  }).production;

  assert.equal(config.host, 'db.internal');
  assert.equal(config.port, 3307);
  assert.equal(config.pool.max, 24);
  assert.equal(config.pool.min, 0);
  assert.equal(config.logging, false);
});

test('database TLS verifies certificates and supports an explicit CA', () => {
  const config = loadConfigInChild({
    DB_SSL: 'true',
    DB_SSL_CA: 'first line\\nsecond line',
  }).production;

  assert.equal(config.dialectOptions.ssl.rejectUnauthorized, true);
  assert.equal(config.dialectOptions.ssl.ca, 'first line\nsecond line');
});

test('invalid pool sizes fail before a database connection is attempted', () => {
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ['-e', `require(${JSON.stringify(configPath)})`],
        {
          env: {
            NODE_ENV: 'test',
            PATH: process.env.PATH,
            DB_POOL_MAX: '2000',
          },
          stdio: 'pipe',
        }
      ),
    /DB_POOL_MAX must be an integer between 1 and 100/
  );
});
