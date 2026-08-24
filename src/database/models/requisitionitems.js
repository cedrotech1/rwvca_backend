"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Requisitionitems extends Model {
    static associate(models) {
      Requisitionitems.belongsTo(models.Requisitions, { foreignKey: "requisition_id", as: "requisition" });
    }
  }

  Requisitionitems.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      requisition_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sn: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "Requisitionitems",
      tableName: "requisitionitems",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return Requisitionitems;
};
