'use strict';

// The baseline migration creates new tables as utf8mb4/utf8mb4_unicode_ci but
// adopts pre-existing tables exactly as they are. A database created with
// MySQL 8 defaults therefore arrives here as utf8mb4_0900_ai_ci, which the
// following exact schema preflight rejects. Normalize adopted tables to the
// target collation so both fresh and adopted databases converge on one
// comparison behaviour before the preflight runs.

const TARGET_CHARSET = 'utf8mb4';
const TARGET_COLLATION = 'utf8mb4_unicode_ci';
const REQUIRED_TABLES = Object.freeze([
  'SequelizeMeta',
  'admins',
  'contacts',
  'projects',
  'settings',
]);

const readTableCollations = async (queryInterface, Sequelize) => {
  const rows = await queryInterface.sequelize.query(
    'SELECT `TABLE_NAME` AS `tableName`, ' +
      '`TABLE_COLLATION` AS `tableCollation` ' +
      'FROM `information_schema`.`TABLES` ' +
      'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (:tableNames)',
    {
      replacements: { tableNames: REQUIRED_TABLES },
      type: Sequelize.QueryTypes.SELECT,
    }
  );

  return new Map(
    rows.map((row) => [
      String(row.tableName),
      String(row.tableCollation || '').toLowerCase(),
    ])
  );
};

const readMismatchedColumns = async (queryInterface, Sequelize) => {
  const rows = await queryInterface.sequelize.query(
    'SELECT `TABLE_NAME` AS `tableName`, `COLUMN_NAME` AS `columnName`, ' +
      '`COLLATION_NAME` AS `collation` ' +
      'FROM `information_schema`.`COLUMNS` ' +
      'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (:tableNames) ' +
      'AND `COLLATION_NAME` IS NOT NULL ' +
      'AND `COLLATION_NAME` <> :targetCollation',
    {
      replacements: {
        tableNames: REQUIRED_TABLES,
        targetCollation: TARGET_COLLATION,
      },
      type: Sequelize.QueryTypes.SELECT,
    }
  );

  return rows.map((row) => `${row.tableName}.${row.columnName}`);
};

const assertCompleteTableInventory = (collations) => {
  const missingTables = REQUIRED_TABLES.filter(
    (tableName) => !collations.has(tableName)
  );
  if (missingTables.length) {
    throw new Error(
      'Cannot normalize database collation; missing tables: ' +
        missingTables.join(', ')
    );
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const collations = await readTableCollations(queryInterface, Sequelize);
    assertCompleteTableInventory(collations);

    const mismatchedColumns = await readMismatchedColumns(
      queryInterface,
      Sequelize
    );
    const tablesWithMismatchedColumns = new Set(
      mismatchedColumns.map((column) => column.split('.')[0])
    );

    for (const tableName of REQUIRED_TABLES) {
      if (
        collations.get(tableName) === TARGET_COLLATION &&
        !tablesWithMismatchedColumns.has(tableName)
      ) {
        continue;
      }

      // Table names come exclusively from REQUIRED_TABLES, never user input.
      // CONVERT TO CHARACTER SET rewrites the table default and every textual
      // column in one statement. Both sides are already utf8mb4 in practice,
      // so this changes comparison rules without widening stored bytes.
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET ` +
          `${TARGET_CHARSET} COLLATE ${TARGET_COLLATION}`
      );
    }

    const verifiedCollations = await readTableCollations(
      queryInterface,
      Sequelize
    );
    assertCompleteTableInventory(verifiedCollations);
    const unconvertedTables = REQUIRED_TABLES.filter(
      (tableName) => verifiedCollations.get(tableName) !== TARGET_COLLATION
    );
    if (unconvertedTables.length) {
      throw new Error(
        `Database tables must use ${TARGET_COLLATION}: ` +
          unconvertedTables.join(', ')
      );
    }

    const unconvertedColumns = await readMismatchedColumns(
      queryInterface,
      Sequelize
    );
    if (unconvertedColumns.length) {
      throw new Error(
        `Database columns must use ${TARGET_COLLATION}: ` +
          unconvertedColumns.join(', ')
      );
    }
  },

  async down() {
    throw new Error(
      'The collation normalization is intentionally irreversible; restoring a ' +
        'mixed-collation schema would reintroduce comparison and join errors.'
    );
  },

  _private: {
    REQUIRED_TABLES,
    TARGET_CHARSET,
    TARGET_COLLATION,
    assertCompleteTableInventory,
    readMismatchedColumns,
    readTableCollations,
  },
};
