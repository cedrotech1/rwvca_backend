"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MissionRequestLogs extends Model {
    static associate(models) {
      MissionRequestLogs.belongsTo(models.MissionRequests, { foreignKey: "request_id", as: "request" });
      MissionRequestLogs.belongsTo(models.Users, { foreignKey: "changed_by", as: "changedByUser" });
    }
  }

  MissionRequestLogs.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      request_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      changed_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "MissionRequestLogs",
      tableName: "mission_request_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return MissionRequestLogs;
};
