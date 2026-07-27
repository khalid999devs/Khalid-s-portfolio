'use strict';

/**
 * Indexes for the two columns the public read path actually uses.
 *
 * `value` is the URL slug every project page is looked up by, and
 * `displayOrder` is the sort key for the catalogue. Neither was indexed, so
 * both did a full table scan. Harmless at three rows, and free to fix now
 * rather than when it is not.
 */

const { QueryTypes } = require('sequelize');

const indexExists = async (sequelize, table, indexName, transaction) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    { replacements: [table, indexName], type: QueryTypes.SELECT, transaction }
  );
  return Number(rows[0]?.count) > 0;
};

module.exports.up = async ({ sequelize, transaction }) => {
  // Not UNIQUE: `value` is derived from the title and existing data may already
  // contain duplicates. Enforcing uniqueness is a separate decision that needs
  // the production data inspected first.
  if (!(await indexExists(sequelize, 'projects', 'projects_value_idx', transaction))) {
    await sequelize.query(
      'CREATE INDEX projects_value_idx ON projects (value)',
      { transaction }
    );
  }

  if (
    !(await indexExists(sequelize, 'projects', 'projects_display_order_idx', transaction))
  ) {
    await sequelize.query(
      'CREATE INDEX projects_display_order_idx ON projects (displayOrder)',
      { transaction }
    );
  }
};
