module.exports = (sequelize, DataTypes) => {
  /**
   * One row per outbound email or SMS attempt.
   *
   * These used to be appended to `./logs/succeed/sentEmails.txt` and its
   * siblings, which had three problems: the path is relative to the working
   * directory so it depended on how the process was started, the directory is
   * gitignored and lives inside the app directory so every deploy threw the
   * history away, and a text file of comma separated pseudo-objects cannot be
   * searched or paginated.
   *
   * Message bodies are deliberately not stored. A delivery log needs to answer
   * "did this reach them, and if not why", which the status and provider
   * response cover. Keeping the body would turn this table into a copy of every
   * message the site has ever sent, including whatever a visitor typed into the
   * contact form.
   */
  const DeliveryLog = sequelize.define(
    'DeliveryLog',
    {
      channel: {
        type: DataTypes.ENUM('email', 'sms'),
        allowNull: false,
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
      status: {
        type: DataTypes.ENUM('succeeded', 'failed'),
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
        { fields: ['createdAt'] },
      ],
    }
  );

  return DeliveryLog;
};
