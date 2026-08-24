"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notifications extends Model {
    static associate(models) {
      Notifications.belongsTo(models.Users, { foreignKey: "receiver_id", as: "receiver" });
    }
  }

  Notifications.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      receiver_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("unread", "read"),
        allowNull: true,
        defaultValue: "unread",
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
      user_type: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: null,
      },
      link: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "Notifications",
      tableName: "notifications",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Notifications;
};
