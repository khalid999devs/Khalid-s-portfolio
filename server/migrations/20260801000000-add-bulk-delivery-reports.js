'use strict';

// Lets one delivery row describe a bulk send: counts, plus a 'partial' status
// for the common case where some recipients took it and some did not.
// Widening the ENUM leaves existing rows valid; they default to kind='single'.

const { QueryTypes } = require('sequelize');

const columnExists = async (sequelize, table, column, transaction) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    { replacements: [table, column], type: QueryTypes.SELECT, transaction }
  );
  return Number(rows[0]?.count) > 0;
};

const addColumn = async (sequelize, transaction, column, definition) => {
  if (await columnExists(sequelize, 'DeliveryLogs', column, transaction)) return;
  await sequelize.query(
    `ALTER TABLE DeliveryLogs ADD COLUMN ${column} ${definition}`,
    { transaction }
  );
};

module.exports.up = async ({ sequelize, transaction }) => {
  await addColumn(
    sequelize,
    transaction,
    'kind',
    `ENUM('single','bulk') NOT NULL DEFAULT 'single'`
  );

  // Null, not 0: the column does not apply to a single send.
  await addColumn(sequelize, transaction, 'recipientCount', 'INT NULL');
  await addColumn(sequelize, transaction, 'succeededCount', 'INT NULL');
  await addColumn(sequelize, transaction, 'failedCount', 'INT NULL');

  await sequelize.query(
    `ALTER TABLE DeliveryLogs
       MODIFY COLUMN status ENUM('succeeded','failed','partial') NOT NULL`,
    { transaction }
  );

  const [indexes] = await sequelize.query(
    `SHOW INDEX FROM DeliveryLogs WHERE Key_name = 'delivery_logs_kind_idx'`,
    { transaction }
  );

  if (!indexes || indexes.length === 0) {
    await sequelize.query(
      `CREATE INDEX delivery_logs_kind_idx ON DeliveryLogs (kind)`,
      { transaction }
    );
  }
};
