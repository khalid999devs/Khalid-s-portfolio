module.exports = (sequelize, DataTypes) => {
  /**
   * The About page's employment history, education and achievements.
   *
   * These lived in `client/src/Constants/index.js`, so adding a job meant
   * editing source and redeploying the front end. One table with a `section`
   * discriminator rather than three tables, because all three render as the
   * same four fields and a shared shape keeps the editor and the API simple.
   *
   *   experience    title = company,  subtitle = designation
   *   education     title = degree,   subtitle = institute
   *   achievement   title = award,    subtitle = awarding body
   */
  const AboutEntry = sequelize.define(
    'AboutEntry',
    {
      section: {
        type: DataTypes.ENUM('experience', 'education', 'achievement'),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      subtitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      /**
       * Free text, not a date type, on purpose. These read "Jul 2025 — Jun 2026"
       * and "2023 — 2027"; forcing them into real dates would mean inventing
       * precision that is not there and rendering it back differently.
       */
      period: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      link: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      /** Ascending. Ties fall back to id so ordering is always deterministic. */
      displayOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      indexes: [{ fields: ['section', 'displayOrder'] }],
    }
  );

  return AboutEntry;
};
