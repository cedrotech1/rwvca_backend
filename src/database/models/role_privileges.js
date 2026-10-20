"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RolePrivileges extends Model {
    static associate(models) {
      RolePrivileges.belongsTo(models.Roles, { foreignKey: "role_id", as: "role" });
      RolePrivileges.belongsTo(models.Privileges, {
        foreignKey: "privilege_id",
        as: "privilege",
      });
    }
  }

  RolePrivileges.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      privilege_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      modelName: "RolePrivileges",
      tableName: "role_privileges",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return RolePrivileges;
};
