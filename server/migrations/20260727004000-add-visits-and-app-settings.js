'use strict';

/**
 * Visit tracking, and a small key/value table for runtime settings.
 *
 * `Visits` holds nothing that identifies a person: no IP, no user agent, no
 * cookie. `visitorHash` is salted with a value that rotates daily and is never
 * persisted, so it separates a refresh from a new arrival for one day and is
 * uncorrelatable after that, even by whoever holds the database.
 *
 * `AppSettings` currently holds one key, the retention window, so that changing
 * how long visits are kept is an admin action rather than a redeploy.
 */

const { QueryTypes } = require('sequelize');

const tableExists = async (sequelize, table, transaction) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table], type: QueryTypes.SELECT, transaction }
  );
  return Number(rows[0]?.count) > 0;
};

module.exports.up = async ({ sequelize, transaction }) => {
  if (!(await tableExists(sequelize, 'Visits', transaction))) {
    await sequelize.query(
      `CREATE TABLE Visits (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        path VARCHAR(255) NOT NULL,
        device VARCHAR(16) NULL,
        referrerHost VARCHAR(128) NULL,
        visitorHash VARCHAR(64) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        INDEX visits_created_at_idx (createdAt),
        INDEX visits_path_idx (path)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      { transaction }
    );
  }

  if (!(await tableExists(sequelize, 'AppSettings', transaction))) {
    await sequelize.query(
      `CREATE TABLE AppSettings (
        \`key\` VARCHAR(64) NOT NULL PRIMARY KEY,
        value VARCHAR(255) NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      { transaction }
    );

    await sequelize.query(
      `INSERT INTO AppSettings (\`key\`, value, createdAt, updatedAt)
       VALUES ('visitRetentionDays', '90', NOW(), NOW())`,
      { transaction }
    );
  }
};
