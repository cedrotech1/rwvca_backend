"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Requisitions extends Model {
    static associate(models) {
      Requisitions.hasMany(models.RequisitionLogs, { foreignKey: "requisition_id", as: "requisition_logs_requisition_id" });
      Requisitions.hasMany(models.RequisitionStatusLog, { foreignKey: "requisition_id", as: "requisition_status_log_requisition_id" });
      Requisitions.hasMany(models.Requisitionitems, { foreignKey: "requisition_id", as: "requisitionitems_requisition_id" });
      Requisitions.belongsTo(models.Department, { foreignKey: "department_id", as: "department" });
      Requisitions.belongsTo(models.Users, { foreignKey: "prepared_by", as: "preparer" });
      Requisitions.belongsTo(models.Users, { foreignKey: "sended_to", as: "sendToUser" });
      Requisitions.belongsTo(models.Users, { foreignKey: "verified_by", as: "verifier" });
      Requisitions.belongsTo(models.Users, { foreignKey: "approved_by", as: "approver" });
      Requisitions.belongsTo(models.Users, { foreignKey: "viewer_id", as: "viewer" });
      Requisitions.belongsTo(models.Users, { foreignKey: "reverted_by", as: "reverter" });
      Requisitions.belongsTo(models.Users, { foreignKey: "submitted_by", as: "submitter" });
      Requisitions.belongsTo(models.Users, { foreignKey: "rejected_by", as: "rejecter" });
      Requisitions.belongsTo(models.Users, { foreignKey: "authorized_by", as: "authorizer" });
    }
  }

  Requisitions.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      department_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      budget_source: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      account_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      total_amount_requested: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      amount_in_words: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      prepared_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      sended_to: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      verified_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      verified_at: {
        type: DataTypes.DATE,
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
      },
      status: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "",
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      viewer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      viewer_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      viewer_comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      viewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reverted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      reverted_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      reversion_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      submitted_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      verification_comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      approval_comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      rejected_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      rejected_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      finance_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      authorized_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      authorized_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      ed_signature_and_stamp: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "no",
      }
    },
    {
      sequelize,
      modelName: "Requisitions",
      tableName: "requisitions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Requisitions;
};
