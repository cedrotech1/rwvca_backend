"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Platforms extends Model {
    static associate(models) {
      Platforms.hasMany(models.PlatformDetails, { foreignKey: "pid", as: "details" });
    }
  }

  Platforms.init(
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
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("published", "draft"),
        allowNull: false,
        defaultValue: "published",
      },
      image: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      display_order: {
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
      }
    },
    {
      sequelize,
      modelName: "Platforms",
      tableName: "platforms",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Platforms;
};
