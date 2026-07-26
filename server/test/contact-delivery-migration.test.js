const assert = require('node:assert/strict');
const test = require('node:test');
const Sequelize = require('sequelize');

const migration = require('../migrations/20260726020000-add-contact-reply-delivery-state');

const toColumnDescription = (definition) => {
  const sequelizeType = definition.type.toString();
  return {
    allowNull: definition.allowNull !== false,
    defaultValue: Object.hasOwn(definition, 'defaultValue')
      ? definition.defaultValue
      : null,
    type: sequelizeType === 'DATE' ? 'DATETIME' : sequelizeType,
  };
};

const createAttemptIndex = (overrides = {}) => ({
  fields: [{ attribute: 'replyAttemptId' }],
  name: migration._private.INDEX_NAME,
  primary: false,
  type: 'BTREE',
  unique: true,
  ...overrides,
});

const createQueryInterface = ({
  columns = {},
  indexes = [],
} = {}) => {
  const calls = [];
  const description = Object.fromEntries(
    Object.entries(columns).map(([columnName, definition]) => [
      columnName,
      definition.type ? toColumnDescription(definition) : definition,
    ])
  );
  const knownIndexes = [...indexes];

  return {
    calls,
    sequelize: {
      async query(sql) {
        calls.push({ method: 'query', sql });
      },
    },
    async addColumn(tableName, columnName, definition) {
      calls.push({ columnName, definition, method: 'addColumn', tableName });
      description[columnName] = toColumnDescription(definition);
    },
    async addIndex(tableName, fields, options) {
      calls.push({ fields, method: 'addIndex', options, tableName });
      knownIndexes.push(
        createAttemptIndex({
          fields: fields.map((attribute) => ({ attribute })),
          name: options.name,
          unique: options.unique,
        })
      );
    },
    async describeTable(tableName) {
      assert.equal(tableName, 'contacts');
      return { ...description };
    },
    async showIndex(tableName) {
      assert.equal(tableName, 'contacts');
      return [...knownIndexes];
    },
  };
};

test('contact delivery migration adds durable state and adopts legacy replies', async () => {
  const queryInterface = createQueryInterface();

  await migration.up(queryInterface, Sequelize);

  assert.deepEqual(
    queryInterface.calls
      .filter((call) => call.method === 'addColumn')
      .map((call) => call.columnName),
    [
      'replyStatus',
      'replyAttemptId',
      'replyRequestedAt',
      'replyAcceptedAt',
    ]
  );
  assert.match(
    queryInterface.calls.find((call) => call.method === 'query').sql,
    /WHEN `replied` = 1 THEN 'accepted'/u
  );
  const indexCall = queryInterface.calls.find(
    (call) => call.method === 'addIndex'
  );
  assert.deepEqual(indexCall.fields, ['replyAttemptId']);
  assert.equal(indexCall.options.unique, true);
});

test('contact delivery migration is idempotent after partial application', async () => {
  const definitions = migration._private.columnDefinitions(Sequelize);
  const queryInterface = createQueryInterface({
    columns: definitions,
    indexes: [createAttemptIndex()],
  });

  await migration.up(queryInterface, Sequelize);

  assert.equal(
    queryInterface.calls.some((call) => call.method === 'addColumn'),
    false
  );
  assert.equal(
    queryInterface.calls.some((call) => call.method === 'addIndex'),
    false
  );
  assert.equal(
    queryInterface.calls.filter((call) => call.method === 'query').length,
    1
  );
});

test('contact delivery migration rejects an incompatible partial column before data adoption', async () => {
  const definitions = migration._private.columnDefinitions(Sequelize);
  const queryInterface = createQueryInterface({
    columns: {
      ...definitions,
      replyStatus: {
        ...definitions.replyStatus,
        type: Sequelize.STRING(32),
      },
    },
  });

  await assert.rejects(
    () => migration.up(queryInterface, Sequelize),
    /replyStatus must use VARCHAR\(16\)/u
  );
  assert.equal(
    queryInterface.calls.some((call) => call.method === 'query'),
    false
  );
});

test('contact delivery migration rejects a same-name non-unique or composite index', async () => {
  const definitions = migration._private.columnDefinitions(Sequelize);

  for (const index of [
    createAttemptIndex({ unique: false }),
    createAttemptIndex({
      fields: [{ attribute: 'replyAttemptId', length: 8 }],
    }),
    createAttemptIndex({
      fields: [
        { attribute: 'replyAttemptId' },
        { attribute: 'replyStatus' },
      ],
    }),
  ]) {
    const queryInterface = createQueryInterface({
      columns: definitions,
      indexes: [index],
    });

    await assert.rejects(
      () => migration.up(queryInterface, Sequelize),
      /must be UNIQUE on exactly replyAttemptId/u
    );
    assert.equal(
      queryInterface.calls.some((call) => call.method === 'query'),
      false
    );
  }
});

test('contact delivery safety migration cannot be reversed automatically', async () => {
  await assert.rejects(
    migration.down(),
    /irreversible safety migration/
  );
});
