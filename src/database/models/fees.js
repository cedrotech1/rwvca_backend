"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Fees extends Model {
    static associate(models) {
      Fees.belongsTo(models.MembershipCategories, { foreignKey: "category_id", as: "category" });
    }
  }

  Fees.init(
    {
      fee_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fee_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: "RWF",
      }
    },
    {
      sequelize,
      modelName: "Fees",
      tableName: "fees",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return Fees;
};
