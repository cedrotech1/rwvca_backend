"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MissionRequests extends Model {
    static associate(models) {
      MissionRequests.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
      MissionRequests.belongsTo(models.Users, { foreignKey: "hr_id", as: "hr" });
      MissionRequests.belongsTo(models.Users, { foreignKey: "executive_id", as: "executive" });
      MissionRequests.hasMany(models.MissionRequestLogs, { foreignKey: "request_id", as: "logs" });
    }
  }

  MissionRequests.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      destination: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      purpose: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      departure_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      return_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      days_requested: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      days_authorized: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      hr_id: {
        type: DataTypes.INTEGER,
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
      mission_requests_status: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "pending",
      },
      hr_verification_status: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "pending",
      },
      hr_signature: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      hr_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      executive_verification_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "pending",
      },
      executive_signature: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      executive_approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      reason: {
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
      submitted_by_hr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      vihicle_prack: {
        type: DataTypes.STRING(100),
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
      modelName: "MissionRequests",
      tableName: "mission_requests",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return MissionRequests;
};
