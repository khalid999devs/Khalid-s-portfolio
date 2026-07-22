module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define(
    'admin',
    {
      userName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      sessionVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'admins',
    }
  );

  return Admin;
};
