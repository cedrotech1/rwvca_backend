"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SupplyRequisitions extends Model {
    static associate(models) {
      SupplyRequisitions.hasMany(models.SupplyRequisitionItems, {
        foreignKey: "supply_requisition_id",
        as: "items",
      });
      SupplyRequisitions.hasMany(models.SupplyRequisitionLogs, {
        foreignKey: "supply_requisition_id",
        as: "logs",
      });
      SupplyRequisitions.belongsTo(models.Users, { foreignKey: "prepared_by", as: "preparer" });
      SupplyRequisitions.belongsTo(models.Users, { foreignKey: "assigned_to", as: "assignee" });
      SupplyRequisitions.belongsTo(models.Users, { foreignKey: "approved_by", as: "approver" });
      SupplyRequisitions.belongsTo(models.Users, { foreignKey: "authorized_by", as: "authorizer" });
      SupplyRequisitions.belongsTo(models.Department, {
        foreignKey: "requester_department_id",
        as: "requesterDepartment",
      });
      SupplyRequisitions.belongsTo(models.Department, {
        foreignKey: "assigned_department_id",
        as: "assignedDepartment",
      });
    }
  }

  SupplyRequisitions.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      supply_type: { type: DataTypes.STRING(30), allowNull: false },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "draft" },
      prepared_by: { type: DataTypes.INTEGER, allowNull: false },
      requester_department_id: { type: DataTypes.INTEGER, allowNull: true },
      assigned_department_id: { type: DataTypes.INTEGER, allowNull: true },
      assigned_to: { type: DataTypes.INTEGER, allowNull: true },
      approved_by: { type: DataTypes.INTEGER, allowNull: true },
      authorized_by: { type: DataTypes.INTEGER, allowNull: true },
      rejected_by: { type: DataTypes.INTEGER, allowNull: true },
      reverted_by: { type: DataTypes.INTEGER, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      reject_reason: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "SupplyRequisitions",
      tableName: "supply_requisitions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  return SupplyRequisitions;
};
