module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('contact', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    replyMsg: {
      type: DataTypes.TEXT,
    },
    replied: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
  });

  return Contact;
};
