"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Reports extends Model {
    static associate(models) {
      Reports.hasMany(models.CustomersNoInvoice, { foreignKey: "report_id", as: "customers_no_invoice_report_id" });
      Reports.hasMany(models.MembershipReportComments, { foreignKey: "report_id", as: "membership_report_comments_report_id" });
      Reports.hasMany(models.MembershipReportItems, { foreignKey: "report_id", as: "membership_report_items_report_id" });
      Reports.hasMany(models.MembershipReportLogs, { foreignKey: "report_id", as: "membership_report_logs_report_id" });
      Reports.hasMany(models.MembershipReportPayments, { foreignKey: "report_id", as: "membership_report_payments_report_id" });
      Reports.hasMany(models.MembershipReportReviewers, { foreignKey: "report_id", as: "membership_report_reviewers_report_id" });
      Reports.hasMany(models.MembershipReportViewers, { foreignKey: "report_id", as: "membership_report_viewers_report_id" });
      Reports.hasMany(models.ReportAttachments, { foreignKey: "report_id", as: "report_attachments_report_id" });
      Reports.hasMany(models.ReportComments, { foreignKey: "report_id", as: "report_comments_report_id" });
      Reports.hasMany(models.ReportRecipient, { foreignKey: "report_id", as: "report_recipient_report_id" });
      Reports.belongsTo(models.Users, { foreignKey: "created_by", as: "creator" });
    }
  }

  Reports.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      period_start: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      period_end: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      time_from: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: null,
      },
      time_to: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: null,
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "Reports",
      tableName: "reports",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Reports;
};
