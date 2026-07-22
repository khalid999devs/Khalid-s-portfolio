'use strict';

const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const test = require('node:test');
const { compare } = require('bcryptjs');

const {
  bootstrapAdmin,
  normalizeAdminUserName,
  parseBcryptCost,
  rotateAdminPassword,
  validateAdminPassword,
} = require('../utils/adminAccount');
const {
  parseCommand,
  readStandardInputSecret,
  run,
  secretsMatch,
} = require('../scripts/admin-account');

const password = 'correct horse battery staple';

const createTransactionHarness = () => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const calls = [];
  return {
    calls,
    transaction,
    sequelize: {
      async transaction(options, callback) {
        calls.push(options);
        return callback(transaction);
      },
    },
  };
};

test('administrator credential validation is length- and bcrypt-aware', () => {
  assert.equal(normalizeAdminUserName('  portfolio-admin  '), 'portfolio-admin');
  assert.equal(parseBcryptCost(undefined), 12);
  assert.equal(parseBcryptCost('10'), 10);
  assert.equal(validateAdminPassword(password), password);
  assert.throws(() => normalizeAdminUserName('bad\nname'), /visible/u);
  assert.throws(() => validateAdminPassword('short'), /at least 16/u);
  assert.throws(() => validateAdminPassword('é'.repeat(37)), /72 UTF-8 bytes/u);
  assert.throws(() => parseBcryptCost('15'), /between 10 and 14/u);
});

test('bootstrap creates the only administrator with a one-way password hash', async () => {
  const harness = createTransactionHarness();
  let createdValues;
  const Admin = {
    async create(values, options) {
      createdValues = values;
      assert.equal(options.transaction, harness.transaction);
      return { id: 1, ...values };
    },
    async findOne(options) {
      assert.equal(options.lock, 'UPDATE');
      return null;
    },
  };

  await bootstrapAdmin({
    Admin,
    bcryptCost: 10,
    password,
    sequelize: harness.sequelize,
    userName: 'portfolio-admin',
  });

  assert.notEqual(createdValues.password, password);
  assert.equal(await compare(password, createdValues.password), true);
  assert.equal(createdValues.sessionVersion, 1);
});

test('bootstrap refuses to create a second administrator', async () => {
  const harness = createTransactionHarness();
  const Admin = {
    async findOne() {
      return { id: 1 };
    },
  };

  await assert.rejects(
    () =>
      bootstrapAdmin({
        Admin,
        bcryptCost: 10,
        password,
        sequelize: harness.sequelize,
        userName: 'portfolio-admin',
      }),
    /bootstrap is locked/u
  );
});

test('rotation changes the hash and increments the session version', async () => {
  const harness = createTransactionHarness();
  let update;
  const admin = {
    sessionVersion: 8,
    async update(values, options) {
      update = values;
      assert.equal(options.transaction, harness.transaction);
    },
  };
  const Admin = {
    async findOne(options) {
      assert.deepEqual(options.where, { userName: 'portfolio-admin' });
      return admin;
    },
  };

  await rotateAdminPassword({
    Admin,
    bcryptCost: 10,
    password,
    sequelize: harness.sequelize,
    userName: 'portfolio-admin',
  });

  assert.equal(update.sessionVersion, 9);
  assert.notEqual(update.password, password);
  assert.equal(await compare(password, update.password), true);
});

test('admin CLI never accepts a password argument and reads stdin verbatim', async () => {
  const attemptedSecret = 'plaintext-secret-on-command-line';
  assert.equal(parseCommand(['bootstrap']), 'bootstrap');
  assert.throws(
    () => parseCommand(['bootstrap', attemptedSecret]),
    (error) =>
      /never accepted as arguments/u.test(error.message) &&
      !error.message.includes(attemptedSecret)
  );

  assert.equal(
    await readStandardInputSecret(Readable.from([`${password}\n`])),
    password
  );
  assert.equal(secretsMatch(password, password), true);
  assert.equal(secretsMatch(password, `${password}!`), false);
});

test('admin CLI checks migrations, consumes stdin, and always closes Sequelize', async () => {
  const harness = createTransactionHarness();
  const output = [];
  let closed = false;
  let createdValues;
  Object.assign(harness.sequelize, {
    async authenticate() {},
    async close() {
      closed = true;
    },
    getQueryInterface() {
      return {
        async showAllTables() {
          return ['SequelizeMeta'];
        },
      };
    },
    async query() {
      return [{ name: '20260722000000-baseline-schema.js' }];
    },
  });

  await run({
    arguments_: ['bootstrap'],
    env: {
      ADMIN_PASSWORD_BCRYPT_COST: '10',
      ADMIN_USERNAME: 'portfolio-admin',
    },
    input: Readable.from([`${password}\n`]),
    loadDatabase: () => ({
      Admin: {
        async create(values) {
          createdValues = values;
          return { id: 1 };
        },
        async findOne() {
          return null;
        },
      },
      sequelize: harness.sequelize,
    }),
    output: {
      isTTY: false,
      write(value) {
        output.push(value);
      },
    },
  });

  assert.equal(closed, true);
  assert.equal(await compare(password, createdValues.password), true);
  assert.match(output.join(''), /created successfully/u);
  assert.equal(output.join('').includes(password), false);
  assert.equal(output.join('').includes(createdValues.password), false);
});
