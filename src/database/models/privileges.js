"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Privileges extends Model {
    static associate(models) {
      Privileges.belongsToMany(models.Roles, {
        through: models.RolePrivileges,
        foreignKey: "privilege_id",
        otherKey: "role_id",
        as: "roles",
      });
      Privileges.hasMany(models.RolePrivileges, {
        foreignKey: "privilege_id",
        as: "role_privilege_rows",
      });
    }
  }

  Privileges.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      code: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "capability",
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "Privileges",
      tableName: "privileges",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Privileges;
};
