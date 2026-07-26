'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Sequelize = require('sequelize');

const migration = require('../migrations/20260726000000-ensure-transactional-engines');

const createQueryInterface = (initialEngines = {}) => {
  const calls = [];
  const engines = new Map(
    migration._private.REQUIRED_TABLES.map((tableName) => [
      tableName,
      initialEngines[tableName] || 'InnoDB',
    ])
  );

  return {
    calls,
    engines,
    sequelize: {
      async query(sql, options = {}) {
        calls.push({ options, sql });
        if (sql.includes('information_schema')) {
          return [...engines].map(([tableName, engine]) => ({
            engine,
            tableName,
          }));
        }

        const match = sql.match(/^ALTER TABLE `([^`]+)` ENGINE=InnoDB$/u);
        if (!match) throw new Error(`Unexpected SQL: ${sql}`);
        engines.set(match[1], 'InnoDB');
        return [];
      },
    },
  };
};

test('engine migration converts legacy non-transactional tables and verifies them', async () => {
  const queryInterface = createQueryInterface({
    projects: 'MyISAM',
    SequelizeMeta: 'myisam',
  });

  await migration.up(queryInterface, Sequelize);

  assert.deepEqual(
    queryInterface.calls
      .filter(({ sql }) => sql.startsWith('ALTER TABLE'))
      .map(({ sql }) => sql),
    [
      'ALTER TABLE `SequelizeMeta` ENGINE=InnoDB',
      'ALTER TABLE `projects` ENGINE=InnoDB',
    ]
  );
  assert.equal(queryInterface.engines.get('SequelizeMeta'), 'InnoDB');
  assert.equal(queryInterface.engines.get('projects'), 'InnoDB');
});

test('engine migration fails closed when the required table inventory is incomplete', async () => {
  const queryInterface = createQueryInterface();
  queryInterface.engines.delete('projects');

  await assert.rejects(
    () => migration.up(queryInterface, Sequelize),
    /missing: projects/u
  );
  assert.equal(
    queryInterface.calls.some(({ sql }) => sql.startsWith('ALTER TABLE')),
    false
  );
});

test('engine migration never restores a non-transactional engine', async () => {
  await assert.rejects(() => migration.down(), /intentionally irreversible/u);
});
