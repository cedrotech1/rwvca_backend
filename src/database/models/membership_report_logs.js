"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipReportLogs extends Model {
    static associate(models) {
      MembershipReportLogs.belongsTo(models.Reports, { foreignKey: "report_id", as: "report" });
      MembershipReportLogs.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  MembershipReportLogs.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("CREATED", "UPDATED", "SUBMITTED", "APPROVED", "REVERTED", "VIEWED", "ASSIGNED", "REVIEWED", "REMOVED"),
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "MembershipReportLogs",
      tableName: "membership_report_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return MembershipReportLogs;
};
