"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Roles extends Model {
    static associate(models) {
      Roles.belongsToMany(models.Privileges, {
        through: models.RolePrivileges,
        foreignKey: "role_id",
        otherKey: "privilege_id",
        as: "privileges",
      });
      Roles.hasMany(models.RolePrivileges, {
        foreignKey: "role_id",
        as: "role_privilege_rows",
      });
    }
  }

  Roles.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      role_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "Roles",
      tableName: "roles",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return Roles;
};
