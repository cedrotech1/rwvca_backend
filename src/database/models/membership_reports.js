"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipReports extends Model {
    static associate(models) {
      MembershipReports.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
      MembershipReports.belongsTo(models.Users, { foreignKey: "submitted_by", as: "submitter" });
      MembershipReports.belongsTo(models.Users, { foreignKey: "approved_by", as: "approver" });
      MembershipReports.hasMany(models.MembershipReportItems, { foreignKey: "report_id", as: "items" });
      MembershipReports.hasMany(models.MembershipReportComments, { foreignKey: "report_id", as: "comments" });
      MembershipReports.hasMany(models.MembershipReportLogs, { foreignKey: "report_id", as: "logs" });
      MembershipReports.hasMany(models.MembershipReportPayments, { foreignKey: "report_id", as: "payments" });
      MembershipReports.hasMany(models.MembershipReportReviewers, { foreignKey: "report_id", as: "reviewers" });
      MembershipReports.hasMany(models.MembershipReportViewers, { foreignKey: "report_id", as: "viewers" });
      MembershipReports.hasMany(models.CustomersNoInvoice, { foreignKey: "report_id", as: "customers" });
    }
  }

  MembershipReports.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_type: {
        type: DataTypes.ENUM("DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"),
        allowNull: true,
        defaultValue: null,
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      month: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      quarter: {
        type: DataTypes.STRING(11),
        allowNull: true,
        defaultValue: null,
      },
      week: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      monthly_month: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      yearly_year: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.ENUM("PENDING", "APPROVED", "REVERTED"),
        allowNull: true,
        defaultValue: "PENDING",
      },
      submitted_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      approved_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "MembershipReports",
      tableName: "membership_reports",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return MembershipReports;
};
