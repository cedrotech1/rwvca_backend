"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class LeaveRequests extends Model {
    static associate(models) {
      LeaveRequests.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
      LeaveRequests.belongsTo(models.Users, { foreignKey: "hr_id", as: "hr" });
      LeaveRequests.belongsTo(models.Users, { foreignKey: "executive_id", as: "executive" });
      LeaveRequests.hasMany(models.LeaveRequestLogs, { foreignKey: "request_id", as: "logs" });
    }
  }

  LeaveRequests.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      leave_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      leave_from: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      return_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      requested_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      carry_over_days_used: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      current_year_days_used: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      carry_over_year: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      current_year: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      days_authorized: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      remaining_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      applied_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      applicant_signature: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      hr_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      hr_verification_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "pending",
      },
      hr_verified_at: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      hr_signature: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      executive_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      chairman_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      executive_verification_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "pending",
      },
      executive_approved_at: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      executive_signature: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      leave_requests_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "pending",
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
      letter_url: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      ed_signature_and_stamp: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "no",
      },
      current_year_val: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      balance_updated: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        defaultValue: 0,
      }
    },
    {
      sequelize,
      modelName: "LeaveRequests",
      tableName: "leave_requests",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return LeaveRequests;
};
