'use strict';

const REQUIRED_TABLES = Object.freeze([
  'SequelizeMeta',
  'admins',
  'contacts',
  'projects',
  'settings',
]);

const readTableEngines = async (queryInterface, Sequelize) => {
  const rows = await queryInterface.sequelize.query(
    'SELECT `TABLE_NAME` AS `tableName`, `ENGINE` AS `engine` ' +
      'FROM `information_schema`.`TABLES` ' +
      'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (:tableNames)',
    {
      replacements: { tableNames: REQUIRED_TABLES },
      type: Sequelize.QueryTypes.SELECT,
    }
  );

  return new Map(
    rows.map((row) => [String(row.tableName), String(row.engine || '')])
  );
};

const assertCompleteTableInventory = (engines) => {
  const missingTables = REQUIRED_TABLES.filter(
    (tableName) => !engines.has(tableName)
  );
  if (missingTables.length) {
    throw new Error(
      'Cannot verify transactional database tables; missing: ' +
        missingTables.join(', ')
    );
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const engines = await readTableEngines(queryInterface, Sequelize);
    assertCompleteTableInventory(engines);

    for (const tableName of REQUIRED_TABLES) {
      if (engines.get(tableName).toLowerCase() !== 'innodb') {
        // Table names come exclusively from REQUIRED_TABLES, never user input.
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${tableName}\` ENGINE=InnoDB`
        );
      }
    }

    const verifiedEngines = await readTableEngines(queryInterface, Sequelize);
    assertCompleteTableInventory(verifiedEngines);
    const nonTransactionalTables = REQUIRED_TABLES.filter(
      (tableName) =>
        verifiedEngines.get(tableName).toLowerCase() !== 'innodb'
    );
    if (nonTransactionalTables.length) {
      throw new Error(
        'Database tables must use InnoDB for safe project mutations: ' +
          nonTransactionalTables.join(', ')
      );
    }
  },

  async down() {
    throw new Error(
      'The InnoDB conversion is intentionally irreversible; restoring a ' +
        'non-transactional storage engine would make project mutations unsafe.'
    );
  },

  _private: {
    REQUIRED_TABLES,
    assertCompleteTableInventory,
    readTableEngines,
  },
};
