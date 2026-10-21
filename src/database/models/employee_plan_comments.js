"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeePlanComments extends Model {
    static associate(models) {
      EmployeePlanComments.belongsTo(models.EmployeePlans, { foreignKey: "plan_id", as: "plan" });
      EmployeePlanComments.belongsTo(models.Users, { foreignKey: "user_id", as: "author" });
    }
  }

  EmployeePlanComments.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      plan_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "EmployeePlanComments",
      tableName: "employee_plan_comments",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );
  return EmployeePlanComments;
};
