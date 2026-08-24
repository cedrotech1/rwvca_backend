"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Attendance extends Model {
    static associate(models) {
      Attendance.belongsTo(models.Users, { foreignKey: "created_by", as: "creator" });
      Attendance.hasMany(models.AttendanceUsers, { foreignKey: "attendance_id", as: "attendance_users_attendance_id" });
    }
  }

  Attendance.init(
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
      type: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      attendance_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.ENUM("draft", "active", "cancelled", "completed"),
        allowNull: true,
        defaultValue: "active",
      }
    },
    {
      sequelize,
      modelName: "Attendance",
      tableName: "attendance",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Attendance;
};
