"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MemberYearPayments extends Model {
    static associate(models) {
      MemberYearPayments.belongsTo(models.Members, { foreignKey: "member_id", as: "member" });
      MemberYearPayments.belongsTo(models.MembershipYears, { foreignKey: "year_id", as: "year" });
    }
  }

  MemberYearPayments.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      member_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      year_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      payment_status: {
        type: DataTypes.ENUM("Paid", "Not Paid", "Partial"),
        allowNull: false,
        defaultValue: "Not Paid",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      modelName: "MemberYearPayments",
      tableName: "member_year_payments",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return MemberYearPayments;
};
