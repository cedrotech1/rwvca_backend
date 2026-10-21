"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SupplyRequisitionItems extends Model {
    static associate(models) {
      SupplyRequisitionItems.belongsTo(models.SupplyRequisitions, {
        foreignKey: "supply_requisition_id",
        as: "requisition",
      });
    }
  }

  SupplyRequisitionItems.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      supply_requisition_id: { type: DataTypes.INTEGER, allowNull: false },
      item_no: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      item_name: { type: DataTypes.STRING(255), allowNull: false },
      quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
      description: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "SupplyRequisitionItems",
      tableName: "supply_requisition_items",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  return SupplyRequisitionItems;
};
