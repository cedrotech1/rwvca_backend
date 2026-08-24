"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Assets extends Model {
    static associate(models) {
      Assets.hasMany(models.AssetLogs, { foreignKey: "asset_id", as: "asset_logs_asset_id" });
      Assets.belongsTo(models.AssetTypes, { foreignKey: "asset_type_id", as: "asset_type" });
      Assets.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  Assets.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      asset_type_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      serial_number: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      label_number: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      location: {
        type: DataTypes.ENUM("office", "user"),
        allowNull: false,
        defaultValue: "office",
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.ENUM("available", "issued", "returned", "damaged"),
        allowNull: false,
        defaultValue: "available",
      },
      issued_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      returned_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      condition_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      revert_status: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "no",
      }
    },
    {
      sequelize,
      modelName: "Assets",
      tableName: "assets",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Assets;
};
