"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeePlanLogs extends Model {
    static associate(models) {
      EmployeePlanLogs.belongsTo(models.EmployeePlans, { foreignKey: "plan_id", as: "plan" });
      EmployeePlanLogs.belongsTo(models.Users, { foreignKey: "changed_by", as: "actor" });
    }
  }

  EmployeePlanLogs.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      plan_id: { type: DataTypes.INTEGER, allowNull: true },
      report_id: { type: DataTypes.INTEGER, allowNull: true },
      action: { type: DataTypes.STRING(80), allowNull: false },
      detail: { type: DataTypes.TEXT, allowNull: true },
      changed_by: { type: DataTypes.INTEGER, allowNull: true },
      meta: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "EmployeePlanLogs",
      tableName: "employee_plan_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );
  return EmployeePlanLogs;
};
