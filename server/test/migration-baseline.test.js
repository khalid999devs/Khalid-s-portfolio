'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sequelize = require('sequelize');

const migration = require('../migrations/20260722000000-baseline-schema');
const db = require('../models');

const historicalDescriptions = {
  admins: {
    id: {},
    userName: {},
    password: {},
    createdAt: {},
    updatedAt: {},
  },
  contacts: {
    id: {},
    name: {},
    phone: {},
    email: {},
    address: {},
    message: {},
    replyMsg: {},
    replied: {},
    createdAt: {},
    updatedAt: {},
  },
  projects: {
    id: {},
    title: {},
    value: {},
    subtitle: {},
    overview: {},
    role: {},
    siteLink: {},
    codeLink: {},
    date: {},
    locationYear: {},
    techStack: {},
    bannerImg: {},
    videos: {},
    thumbnailContents: {},
    sliderContents: {},
    createdAt: {},
    updatedAt: {},
  },
  settings: {
    id: {},
    technologies: {},
    createdAt: {},
    updatedAt: {},
  },
};

const createQueryInterface = ({
  descriptions = historicalDescriptions,
  indexes = {},
  projectRows = [],
  tables = Object.keys(historicalDescriptions),
} = {}) => {
  const calls = [];
  return {
    calls,
    sequelize: {
      async query(sql, options) {
        calls.push({ method: 'query', options, sql });
        return projectRows;
      },
    },
    async addColumn(tableName, columnName, definition) {
      calls.push({ columnName, definition, method: 'addColumn', tableName });
    },
    async addIndex(tableName, fields, options) {
      calls.push({ fields, method: 'addIndex', options, tableName });
    },
    async bulkUpdate(tableName, values, where) {
      calls.push({ method: 'bulkUpdate', tableName, values, where });
    },
    async changeColumn(tableName, columnName, definition) {
      calls.push({ columnName, definition, method: 'changeColumn', tableName });
    },
    async createTable(tableName, schema, options) {
      calls.push({ method: 'createTable', options, schema, tableName });
    },
    async describeTable(tableName) {
      calls.push({ method: 'describeTable', tableName });
      return descriptions[tableName];
    },
    async showAllTables() {
      calls.push({ method: 'showAllTables' });
      return tables;
    },
    async showIndex(tableName) {
      calls.push({ method: 'showIndex', tableName });
      return indexes[tableName] || [];
    },
  };
};

test('baseline creates the complete schema for a fresh database', async () => {
  const queryInterface = createQueryInterface({ tables: [] });

  await migration.up(queryInterface, Sequelize);

  const createdTables = queryInterface.calls
    .filter((call) => call.method === 'createTable')
    .map((call) => call.tableName);
  assert.deepEqual(createdTables, [
    'admins',
    'contacts',
    'projects',
    'settings',
  ]);

  const adminTable = queryInterface.calls.find(
    (call) => call.method === 'createTable' && call.tableName === 'admins'
  );
  assert.equal(adminTable.schema.sessionVersion.defaultValue, 0);
  assert.equal(adminTable.options.charset, 'utf8mb4');
  assert.equal(
    queryInterface.calls.some(
      (call) =>
        call.method === 'addIndex' &&
        call.options.name === 'admins_user_name_unique'
    ),
    true
  );
  assert.equal(
    queryInterface.calls.some(
      (call) =>
        call.method === 'addIndex' &&
        call.options.name === 'projects_value_unique' &&
        call.options.unique === true
    ),
    true
  );
});

test('fresh migration column definitions stay aligned with Sequelize models', () => {
  const tableSchemas = migration._private.schemas(Sequelize);
  const modelsByTable = {
    admins: db.Admin,
    contacts: db.Contact,
    projects: db.projects,
    settings: db.settings,
  };

  for (const [tableName, model] of Object.entries(modelsByTable)) {
    const schema = tableSchemas[tableName];
    assert.equal(model.getTableName(), tableName);
    assert.deepEqual(Object.keys(schema), Object.keys(model.rawAttributes));

    for (const [columnName, definition] of Object.entries(schema)) {
      const modelAttribute = model.rawAttributes[columnName];
      const migrationType =
        typeof definition.type === 'function'
          ? new definition.type().toString()
          : definition.type.toString();
      assert.equal(
        migrationType,
        modelAttribute.type.toString(),
        `${tableName}.${columnName} type`
      );
      assert.equal(
        definition.allowNull !== false,
        modelAttribute.allowNull !== false,
        `${tableName}.${columnName} nullability`
      );
      if (Object.hasOwn(definition, 'defaultValue')) {
        assert.equal(
          definition.defaultValue,
          modelAttribute.defaultValue,
          `${tableName}.${columnName} default`
        );
      }
    }
  }
});

test('baseline adopts the known legacy schema without recreating tables', async () => {
  const queryInterface = createQueryInterface({
    projectRows: [
      { id: 4, displayOrder: 0 },
      { id: 9, displayOrder: 0 },
    ],
  });

  await migration.up(queryInterface, Sequelize);

  assert.equal(
    queryInterface.calls.some((call) => call.method === 'createTable'),
    false
  );
  assert.deepEqual(
    queryInterface.calls
      .filter((call) => call.method === 'addColumn')
      .map((call) => `${call.tableName}.${call.columnName}`),
    [
      'admins.sessionVersion',
      'projects.category',
      'projects.designLink',
      'projects.displayOrder',
    ]
  );
  assert.deepEqual(
    queryInterface.calls
      .filter(
        (call) =>
          call.method === 'bulkUpdate' &&
          Object.hasOwn(call.values, 'displayOrder')
      )
      .map((call) => ({ values: call.values, where: call.where })),
    [
      { values: { displayOrder: 0 }, where: { id: 4 } },
      { values: { displayOrder: 1 }, where: { id: 9 } },
    ]
  );
  assert.equal(
    queryInterface.calls.some(
      (call) =>
        call.method === 'changeColumn' &&
        call.tableName === 'projects' &&
        call.columnName === 'role'
    ),
    true
  );
});

test('baseline preserves an already contiguous project order and existing indexes', async () => {
  const descriptions = structuredClone(historicalDescriptions);
  descriptions.admins.sessionVersion = {};
  descriptions.projects.category = {};
  descriptions.projects.designLink = {};
  descriptions.projects.displayOrder = {};
  const queryInterface = createQueryInterface({
    descriptions,
    indexes: {
      admins: [
        { fields: [{ attribute: 'userName' }], unique: true },
      ],
      projects: [
        {
          fields: [{ attribute: 'value' }],
          unique: true,
        },
        { fields: [{ attribute: 'displayOrder' }] },
      ],
    },
    projectRows: [
      { id: 9, displayOrder: 0 },
      { id: 4, displayOrder: 1 },
    ],
  });

  await migration.up(queryInterface, Sequelize);

  assert.equal(
    queryInterface.calls.some(
      (call) => ['addColumn', 'addIndex'].includes(call.method)
    ),
    false
  );
  assert.deepEqual(
    queryInterface.calls
      .filter(
        (call) =>
          call.method === 'bulkUpdate' &&
          Object.hasOwn(call.values, 'displayOrder')
      ),
    []
  );
});

test('baseline repairs a null display order even when it is the only row', async () => {
  const descriptions = structuredClone(historicalDescriptions);
  descriptions.admins.sessionVersion = {};
  descriptions.projects.category = {};
  descriptions.projects.designLink = {};
  descriptions.projects.displayOrder = {};
  const queryInterface = createQueryInterface({
    descriptions,
    projectRows: [{ id: 7, displayOrder: null }],
  });

  await migration.up(queryInterface, Sequelize);

  assert.deepEqual(
    queryInterface.calls
      .filter(
        (call) =>
          call.method === 'bulkUpdate' &&
          Object.hasOwn(call.values, 'displayOrder')
      )
      .map((call) => ({ values: call.values, where: call.where })),
    [{ values: { displayOrder: 0 }, where: { id: 7 } }]
  );
});

test('baseline refuses unknown partial schemas and cannot drop adopted data', async () => {
  const descriptions = structuredClone(historicalDescriptions);
  delete descriptions.projects.overview;
  const queryInterface = createQueryInterface({ descriptions });

  await assert.rejects(
    () => migration.up(queryInterface, Sequelize),
    /Existing table projects.*missing columns: overview/u
  );
  await assert.rejects(
    () => migration.down(),
    /intentionally irreversible/u
  );
});

test('baseline rejects incompatible critical column metadata when the dialect exposes it', () => {
  const descriptions = structuredClone(historicalDescriptions);
  descriptions.projects.id = {
    allowNull: false,
    primaryKey: true,
    type: 'INT(11)',
  };
  descriptions.projects.overview = {
    allowNull: false,
    type: 'VARCHAR(255)',
  };

  assert.throws(
    () =>
      migration._private.assertCompatibleExistingTable(
        'projects',
        descriptions.projects
      ),
    /overview has incompatible type VARCHAR\(255\)/u
  );

  descriptions.projects.overview = {
    allowNull: true,
    type: 'TEXT',
  };
  assert.throws(
    () =>
      migration._private.assertCompatibleExistingTable(
        'projects',
        descriptions.projects
      ),
    /overview must be NOT NULL/u
  );

  descriptions.projects.overview.allowNull = false;
  descriptions.projects.id.primaryKey = false;
  assert.throws(
    () =>
      migration._private.assertCompatibleExistingTable(
        'projects',
        descriptions.projects
      ),
    /id must be the primary key/u
  );
});

test('baseline accepts the supported legacy VARCHAR role before widening it', () => {
  const description = structuredClone(historicalDescriptions.projects);
  description.id = {
    allowNull: false,
    primaryKey: true,
    type: 'INTEGER UNSIGNED',
  };
  description.role = {
    allowNull: false,
    type: 'VARCHAR(255)',
  };
  description.overview = {
    allowNull: false,
    type: 'TEXT',
  };

  assert.doesNotThrow(() =>
    migration._private.assertCompatibleExistingTable('projects', description)
  );
});
