"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Department extends Model {
    static associate(models) {
      Department.hasMany(models.Requisitions, { foreignKey: "department_id", as: "requisitions_department_id" });
      Department.hasMany(models.SpecialRequisitions, { foreignKey: "department_id", as: "special_requisitions_department_id" });
      Department.hasMany(models.Users, { foreignKey: "department_ID", as: "users_department_ID" });
    }
  }

  Department.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "Department",
      tableName: "department",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return Department;
};
