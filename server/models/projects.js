module.exports = (sequelize, DataTypes) => {
  const projects = sequelize.define('projects', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      defaultValue: 'all',
    },
    subtitle: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    overview: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    role: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
    },
    siteLink: {
      type: DataTypes.STRING,
    },
    designLink: {
      type: DataTypes.STRING,
    },
    codeLink: {
      type: DataTypes.STRING,
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    locationYear: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    techStack: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
    },
    bannerImg: {
      type: DataTypes.STRING,
    },
    videos: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
    },
    thumbnailContents: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
    },
    sliderContents: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  return projects;
};
