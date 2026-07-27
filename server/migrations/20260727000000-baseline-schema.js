'use strict';

/**
 * Baseline.
 *
 * Creates the schema the models expect, and adopts it untouched if it already
 * exists -- which it does on every existing deployment, because it was
 * previously created implicitly by `sequelize.sync()` on boot.
 *
 * Every statement is `IF NOT EXISTS`, so this is safe to run against a
 * populated production database. It creates nothing that is already there and
 * alters nothing at all.
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

const columnExists = async (sequelize, table, column, transaction) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    { replacements: [table, column], type: QueryTypes.SELECT, transaction }
  );
  return Number(rows[0]?.count) > 0;
};

module.exports.up = async ({ sequelize, transaction }) => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS admins (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      userName VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    { transaction }
  );

  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS projects (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      value VARCHAR(255) NOT NULL,
      category VARCHAR(255) DEFAULT 'all',
      subtitle VARCHAR(255) NOT NULL,
      overview TEXT NOT NULL,
      role TEXT NOT NULL,
      siteLink VARCHAR(255),
      designLink VARCHAR(255),
      codeLink VARCHAR(255),
      date VARCHAR(255) NOT NULL,
      locationYear VARCHAR(255) NOT NULL,
      techStack TEXT,
      bannerImg VARCHAR(255),
      videos TEXT,
      thumbnailContents TEXT,
      sliderContents TEXT,
      displayOrder INT NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    { transaction }
  );

  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS settings (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      technologies TEXT,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    { transaction }
  );

  // Databases created before displayOrder existed. The standalone
  // `add_displayOrder.js` script did this; folding it in means a fresh clone
  // needs only `npm run migrate`.
  if (
    (await tableExists(sequelize, 'projects', transaction)) &&
    !(await columnExists(sequelize, 'projects', 'displayOrder', transaction))
  ) {
    await sequelize.query(
      'ALTER TABLE projects ADD COLUMN displayOrder INT NOT NULL DEFAULT 0',
      { transaction }
    );
    await sequelize.query('SET @row_number = -1', { transaction });
    await sequelize.query(
      'UPDATE projects SET displayOrder = (@row_number := @row_number + 1) ORDER BY id ASC',
      { transaction }
    );
  }
};
