module.exports = (sequelize, DataTypes) => {
  // One row per outbound email or SMS attempt. Bodies are never stored: the
  // status and provider response answer "did it arrive, and if not why".
  const DeliveryLog = sequelize.define(
    'DeliveryLog',
    {
      channel: {
        type: DataTypes.ENUM('email', 'sms'),
        allowNull: false,
      },
      /** One message, or the report for a batch. */
      kind: {
        type: DataTypes.ENUM('single', 'bulk'),
        allowNull: false,
        defaultValue: 'single',
      },
      /** Which template or call site produced this, e.g. "custom", "contact". */
      mode: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      /** Address or number. Indexed because it is the common search term. */
      recipient: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      /** 'partial' is bulk only: some recipients took it, some did not. */
      status: {
        type: DataTypes.ENUM('succeeded', 'failed', 'partial'),
        allowNull: false,
      },
      /** Provider status code, e.g. an SMS gateway's numeric result. */
      providerCode: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      /** Provider message or error text, truncated. */
      detail: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      /** Batch totals. Null on single sends. */
      recipientCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      succeededCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      failedCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      /** Milliseconds spent in the provider call. */
      durationMs: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      indexes: [
        { fields: ['status'] },
        { fields: ['channel'] },
        { fields: ['kind'] },
        { fields: ['createdAt'] },
      ],
    }
  );

  return DeliveryLog;
};
