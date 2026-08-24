"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TodoActivityLog extends Model {
    static associate(models) {
      TodoActivityLog.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  TodoActivityLog.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      task_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "TodoActivityLog",
      tableName: "todo_activity_log",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return TodoActivityLog;
};
