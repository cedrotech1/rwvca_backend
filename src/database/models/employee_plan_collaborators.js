"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EmployeePlanCollaborators extends Model {
    static associate(models) {
      EmployeePlanCollaborators.belongsTo(models.EmployeePlans, { foreignKey: "plan_id", as: "plan" });
      EmployeePlanCollaborators.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  EmployeePlanCollaborators.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      plan_id: { type: DataTypes.INTEGER, allowNull: false },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      response_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "pending" },
      reply_note: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "EmployeePlanCollaborators",
      tableName: "employee_plan_collaborators",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  return EmployeePlanCollaborators;
};
