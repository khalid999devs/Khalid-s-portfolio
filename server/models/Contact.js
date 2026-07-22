module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define(
    'contact',
    {
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING(255),
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
        defaultValue: false,
      },
    },
    {
      tableName: 'contacts',
    },
  );

  return Contact;
};
