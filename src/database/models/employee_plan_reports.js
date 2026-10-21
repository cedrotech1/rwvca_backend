"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeePlanReports extends Model {
    static associate(models) {
      EmployeePlanReports.belongsTo(models.Users, { foreignKey: "user_id", as: "author" });
    }
  }

  EmployeePlanReports.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      report_type: { type: DataTypes.STRING(20), allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      period_start: { type: DataTypes.DATEONLY, allowNull: false },
      period_end: { type: DataTypes.DATEONLY, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: true },
      shared_department_ids: { type: DataTypes.TEXT, allowNull: true },
      shared_user_ids: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "EmployeePlanReports",
      tableName: "employee_plan_reports",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  return EmployeePlanReports;
};
