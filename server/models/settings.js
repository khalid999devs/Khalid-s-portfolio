module.exports = (sequelize, DataTypes) => {
  const settings = sequelize.define('settings', {
    technologies: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
    },
  });

  return settings;
};
