"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CustomersNoInvoice extends Model {
    static associate(models) {
      CustomersNoInvoice.belongsTo(models.Reports, { foreignKey: "report_id", as: "report" });
    }
  }

  CustomersNoInvoice.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "CustomersNoInvoice",
      tableName: "customers_no_invoice",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return CustomersNoInvoice;
};
