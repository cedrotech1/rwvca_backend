"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AssetLogs extends Model {
    static associate(models) {
      AssetLogs.belongsTo(models.Assets, { foreignKey: "asset_id", as: "asset" });
      AssetLogs.belongsTo(models.Users, { foreignKey: "performed_by_user_id", as: "performed_by_user" });
      AssetLogs.belongsTo(models.Users, { foreignKey: "assigned_to_user_id", as: "assigned_to_user" });
    }
  }

  AssetLogs.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      asset_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      performed_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assigned_to_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
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
      modelName: "AssetLogs",
      tableName: "asset_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return AssetLogs;
};
