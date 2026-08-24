"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AssetTypes extends Model {
    static associate(models) {
      AssetTypes.hasMany(models.Assets, { foreignKey: "asset_type_id", as: "assets_asset_type_id" });
    }
  }

  AssetTypes.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
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
      modelName: "AssetTypes",
      tableName: "asset_types",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return AssetTypes;
};
