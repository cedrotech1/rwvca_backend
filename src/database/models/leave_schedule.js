"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class LeaveSchedule extends Model {
    static associate(models) {
      LeaveSchedule.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
      LeaveSchedule.hasMany(models.LeaveScheduleReplies, { foreignKey: "leave_schedule_id", as: "leave_schedule_replies_leave_schedule_id" });
    }
  }

  LeaveSchedule.init(
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
      from_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      return_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      hr_read_status: {
        type: DataTypes.ENUM("unread", "read"),
        allowNull: false,
        defaultValue: "unread",
      },
      ed_read_status: {
        type: DataTypes.ENUM("unread", "read"),
        allowNull: false,
        defaultValue: "unread",
      },
      hr_read_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      ed_read_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      status_changed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status_changed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      last_reply_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      last_reply_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      unread_reply_count: {
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
      modelName: "LeaveSchedule",
      tableName: "leave_schedule",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return LeaveSchedule;
};
