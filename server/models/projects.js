const validateHttpUrl = (value) => {
  if (value === null || value === undefined || value === '') return;

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch (error) {
    throw new Error('must be a valid HTTP(S) URL');
  }

  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error('must be a valid HTTP(S) URL');
  }
};

const validateStringArray = (fieldName, maxItems, required = false) =>
  function validateArray(value) {
    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
    } catch (error) {
      throw new Error(`${fieldName} must contain valid JSON`);
    }

    if (
      !Array.isArray(parsedValue) ||
      parsedValue.length > maxItems ||
      (required && parsedValue.length === 0) ||
      parsedValue.some(
        (item) =>
          typeof item !== 'string' ||
          item.length === 0 ||
          [...item].length > 120
      )
    ) {
      throw new Error(`${fieldName} must contain a bounded string array`);
    }
  };

module.exports = (sequelize, DataTypes) => {
  const projects = sequelize.define('projects', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [1, 160], notEmpty: true },
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'projects_value_unique',
      validate: {
        is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
        len: [1, 160],
        notEmpty: true,
      },
    },
    category: {
      type: DataTypes.STRING,
      defaultValue: 'all',
      validate: { len: [1, 80], notEmpty: true },
    },
    subtitle: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [1, 255], notEmpty: true },
    },
    overview: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        fitsTextColumn(value) {
          if (Buffer.byteLength(value, 'utf8') > 60_000) {
            throw new Error('overview exceeds the safe TEXT storage size');
          }
        },
        len: [1, 20_000],
        notEmpty: true,
      },
    },
    role: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      validate: {
        isBoundedStringArray: validateStringArray('role', 32, true),
      },
    },
    siteLink: {
      type: DataTypes.STRING,
      validate: { isHttpUrl: validateHttpUrl },
    },
    designLink: {
      type: DataTypes.STRING,
      validate: { isHttpUrl: validateHttpUrl },
    },
    codeLink: {
      type: DataTypes.STRING,
      validate: { isHttpUrl: validateHttpUrl },
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [1, 80], notEmpty: true },
    },
    locationYear: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { len: [1, 160], notEmpty: true },
    },
    techStack: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      validate: {
        isBoundedStringArray: validateStringArray('techStack', 64),
      },
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
      validate: { isInt: true, min: 0 },
    },
  }, {
    tableName: 'projects',
  });

  return projects;
};
