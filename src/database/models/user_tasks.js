"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class UserTasks extends Model {
    static associate(models) {
      UserTasks.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
      UserTasks.belongsTo(models.Users, { foreignKey: "shared_by", as: "sharedByUser" });
      UserTasks.hasMany(models.TodoComments, { foreignKey: "task_id", as: "comments" });
      UserTasks.hasMany(models.TodoShares, { foreignKey: "task_id", as: "shares" });
      UserTasks.hasMany(models.TodoActivityLog, { foreignKey: "task_id", as: "activityLogs" });
    }
  }

  UserTasks.init(
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
      title: {
        type: DataTypes.STRING(300),
        allowNull: false,
      },
      due_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      is_completed: {
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
      },
      from_datetime: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      to_datetime: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      priority: {
        type: DataTypes.ENUM("Low", "Medium", "High", "Urgent"),
        allowNull: true,
        defaultValue: "Medium",
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      is_shared: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      shared_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      shared_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "UserTasks",
      tableName: "user_tasks",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return UserTasks;
};
