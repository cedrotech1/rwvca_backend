"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipReportReviewers extends Model {
    static associate(models) {
      MembershipReportReviewers.belongsTo(models.MembershipReports, { foreignKey: "report_id", as: "report" });
      MembershipReportReviewers.belongsTo(models.Users, { foreignKey: "reviewer_id", as: "reviewer" });
      MembershipReportReviewers.belongsTo(models.Users, { foreignKey: "assigned_by", as: "assigner" });
    }
  }

  MembershipReportReviewers.init(
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
      reviewer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assigned_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.ENUM("PENDING", "REVIEWED", "APPROVED", "REJECTED"),
        allowNull: true,
        defaultValue: "PENDING",
      },
      assigned_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "MembershipReportReviewers",
      tableName: "membership_report_reviewers",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return MembershipReportReviewers;
};
