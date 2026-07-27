module.exports = (sequelize, DataTypes) => {
  const settings = sequelize.define('settings', {
    technologies: {
      type: DataTypes.TEXT,
      defaultValue: '{}',
    },
    /**
     * URL-style relative path to the stored resume, e.g.
     * "uploads/assets/resume_<32 hex>.pdf". Null when none has been uploaded.
     *
     * The resume used to be a filename hardcoded in three places: the download
     * controller, the client's static link, and the attachment name. Replacing
     * it meant copying a file onto the server under exactly that name, and the
     * controller resolved it against the application directory while the static
     * mount served from UPLOADS_ROOT -- so as soon as UPLOADS_DIR pointed at a
     * volume, which deployment requires, the two disagreed and both viewing and
     * downloading broke.
     */
    resume: {
      type: DataTypes.STRING(512),
      allowNull: true,
      defaultValue: null,
    },
    /**
     * The filename to present on download. Separate from the stored path
     * because the stored name is deliberately random, and a visitor should not
     * receive "resume_9f2c...pdf".
     */
    resumeOriginalName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
  });

  return settings;
};
