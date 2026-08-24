"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TodoShares extends Model {
    static associate(models) {
      TodoShares.belongsTo(models.Users, { foreignKey: "shared_by", as: "sharedByUser" });
    }
  }

  TodoShares.init(
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
      shared_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      shared_with: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      permission: {
        type: DataTypes.ENUM("view", "edit", "complete"),
        allowNull: true,
        defaultValue: "view",
      },
      status: {
        type: DataTypes.ENUM("pending", "accepted", "declined"),
        allowNull: true,
        defaultValue: "pending",
      },
      shared_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      responded_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      comments: {
        type: DataTypes.TEXT,
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: "TodoShares",
      tableName: "todo_shares",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return TodoShares;
};
