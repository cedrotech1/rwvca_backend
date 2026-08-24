"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class LeaveScheduleReplies extends Model {
    static associate(models) {
      LeaveScheduleReplies.belongsTo(models.LeaveSchedule, { foreignKey: "leave_schedule_id", as: "leave_schedule" });
      LeaveScheduleReplies.belongsTo(models.Users, { foreignKey: "sender_id", as: "sender" });
      LeaveScheduleReplies.belongsTo(models.Users, { foreignKey: "receiver_id", as: "receiver" });
    }
  }

  LeaveScheduleReplies.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      leave_schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      receiver_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      reply_type: {
        type: DataTypes.ENUM("comment", "question", "answer", "approval_comment", "rejection_reason"),
        allowNull: true,
        defaultValue: "comment",
      },
      is_internal: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
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
      modelName: "LeaveScheduleReplies",
      tableName: "leave_schedule_replies",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return LeaveScheduleReplies;
};
