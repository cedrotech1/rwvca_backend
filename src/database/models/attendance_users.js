"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AttendanceUsers extends Model {
    static associate(models) {
      AttendanceUsers.belongsTo(models.Attendance, { foreignKey: "attendance_id", as: "attendance" });
      AttendanceUsers.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  AttendanceUsers.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      attendance_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      signed: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      responded_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "AttendanceUsers",
      tableName: "attendance_users",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return AttendanceUsers;
};
