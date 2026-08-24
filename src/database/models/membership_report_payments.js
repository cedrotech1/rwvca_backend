"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipReportPayments extends Model {
    static associate(models) {
      MembershipReportPayments.belongsTo(models.Reports, { foreignKey: "report_id", as: "report" });
    }
  }

  MembershipReportPayments.init(
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
      method: {
        type: DataTypes.ENUM("MOMO", "CASH", "BANK", "NOT_INVOICED", "MEMBERSHIP_FEES_REGISTRETION", "MEMBERSHIP_FEES_CONTRIBUTION"),
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
      modelName: "MembershipReportPayments",
      tableName: "membership_report_payments",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return MembershipReportPayments;
};
