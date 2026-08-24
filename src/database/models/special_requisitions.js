"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SpecialRequisitions extends Model {
    static associate(models) {
      SpecialRequisitions.hasMany(models.SpecialRequisitionLogs, { foreignKey: "special_requisition_id", as: "special_requisition_logs_special_requisition_id" });
      SpecialRequisitions.belongsTo(models.Department, { foreignKey: "department_id", as: "department" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "prepared_by", as: "preparer" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "sended_to", as: "sendToUser" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "verified_by", as: "verifier" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "approved_by", as: "approver" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "viewer_id", as: "viewer" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "reverted_by", as: "reverter" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "rejected_by", as: "rejecter" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "authorized_by", as: "authorizer" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "coordinator_id", as: "coordinator" });
      SpecialRequisitions.belongsTo(models.Users, { foreignKey: "executive_id", as: "executiveUser" });
    }
  }

  SpecialRequisitions.init(
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
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      start_time: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      end_time: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "Other",
      },
      type_other: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      department_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      prepared_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      sended_to: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      executive_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      coordinator_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      coordinator_verification_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      executive_verification_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "pending",
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
      coordinator_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      coordinator_signature: {
        type: DataTypes.STRING(10),
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
      executive_signature: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: null,
      },
      executive_approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      ed_signature_and_stamp: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: "no",
      },
      status: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "draft",
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "SpecialRequisitions",
      tableName: "special_requisitions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return SpecialRequisitions;
};
