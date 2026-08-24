"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Logs extends Model {
    static associate(models) {
      Logs.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  Logs.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      description: {
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
      modelName: "Logs",
      tableName: "logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return Logs;
};
