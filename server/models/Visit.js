module.exports = (sequelize, DataTypes) => {
  /**
   * One row per page view.
   *
   * Deliberately anonymous. No IP address, no user agent, no cookie, no
   * fingerprint: a portfolio needs to know which pages get looked at and when,
   * and nothing stored here can be tied back to a person. That also keeps it
   * clear of consent requirements, which is the practical reason as much as the
   * principled one.
   *
   * `visitorHash` is a daily-rotating, salted hash used only to separate "one
   * person refreshing" from "ten people arriving". The salt changes every day,
   * so yesterday's hashes cannot be correlated with today's even by whoever
   * holds the database.
   */
  const Visit = sequelize.define(
    'Visit',
    {
      path: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /** Coarse bucket: 'desktop' | 'tablet' | 'mobile'. */
      device: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      /** Referrer host only, never the full URL with its query string. */
      referrerHost: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      visitorHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
    },
    {
      indexes: [{ fields: ['createdAt'] }, { fields: ['path'] }],
    }
  );

  return Visit;
};
