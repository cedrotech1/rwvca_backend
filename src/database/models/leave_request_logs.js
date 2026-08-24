"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class LeaveRequestLogs extends Model {
    static associate(models) {
      LeaveRequestLogs.belongsTo(models.LeaveRequests, { foreignKey: "request_id", as: "request" });
      LeaveRequestLogs.belongsTo(models.Users, { foreignKey: "changed_by", as: "changedByUser" });
    }
  }

  LeaveRequestLogs.init(
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
        type: DataTypes.STRING(50),
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
      modelName: "LeaveRequestLogs",
      tableName: "leave_request_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return LeaveRequestLogs;
};
