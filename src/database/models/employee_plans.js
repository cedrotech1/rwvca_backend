"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeePlans extends Model {
    static associate(models) {
      EmployeePlans.belongsTo(models.Users, { foreignKey: "user_id", as: "owner" });
      EmployeePlans.hasMany(models.EmployeePlanCollaborators, {
        foreignKey: "plan_id",
        as: "collaborators",
      });
      EmployeePlans.hasMany(models.EmployeePlanComments, {
        foreignKey: "plan_id",
        as: "comments",
      });
      EmployeePlans.hasMany(models.EmployeePlanLogs, {
        foreignKey: "plan_id",
        as: "logs",
      });
    }
  }

  EmployeePlans.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(300), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      start_date: { type: DataTypes.DATEONLY, allowNull: false },
      end_date: { type: DataTypes.DATEONLY, allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "draft" },
      is_joint: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "EmployeePlans",
      tableName: "employee_plans",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  return EmployeePlans;
};
