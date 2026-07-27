module.exports = (sequelize, DataTypes) => {
  /**
   * Small key/value store for settings an administrator changes at runtime.
   *
   * Separate from the `settings` table, which holds site content. This holds
   * operational choices, currently just how long visit records are kept. Those
   * belong in the database rather than the environment: changing a retention
   * window should not require a redeploy, and the person who wants to change it
   * is sitting in the admin panel, not on the server.
   */
  const AppSetting = sequelize.define('AppSetting', {
    key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
    },
    value: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  });

  return AppSetting;
};
