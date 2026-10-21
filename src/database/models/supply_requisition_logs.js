"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SupplyRequisitionLogs extends Model {
    static associate(models) {
      SupplyRequisitionLogs.belongsTo(models.SupplyRequisitions, {
        foreignKey: "supply_requisition_id",
        as: "requisition",
      });
      SupplyRequisitionLogs.belongsTo(models.Users, { foreignKey: "changed_by", as: "actor" });
    }
  }

  SupplyRequisitionLogs.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      supply_requisition_id: { type: DataTypes.INTEGER, allowNull: false },
      action: { type: DataTypes.STRING(80), allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: true },
      changed_by: { type: DataTypes.INTEGER, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "SupplyRequisitionLogs",
      tableName: "supply_requisition_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );
  return SupplyRequisitionLogs;
};
