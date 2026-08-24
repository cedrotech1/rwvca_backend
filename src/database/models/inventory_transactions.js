"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class InventoryTransactions extends Model {
    static associate(models) {
      InventoryTransactions.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
      InventoryTransactions.belongsTo(models.InventoryItems, { foreignKey: "item_id", as: "item" });
    }
  }

  InventoryTransactions.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("in", "out"),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      transaction_date: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "InventoryTransactions",
      tableName: "inventory_transactions",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return InventoryTransactions;
};
