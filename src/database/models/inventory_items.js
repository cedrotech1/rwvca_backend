"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class InventoryItems extends Model {
    static associate(models) {
      InventoryItems.belongsTo(models.Users, { foreignKey: "created_by", as: "creator" });
      InventoryItems.hasMany(models.InventoryTransactions, { foreignKey: "item_id", as: "transactions" });
    }
  }

  InventoryItems.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      unit: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "pieces",
      },
      current_quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      min_stock: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 10,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "InventoryItems",
      tableName: "inventory_items",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return InventoryItems;
};
