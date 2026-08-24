"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Gallery extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  Gallery.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
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
      album_link: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "Gallery",
      tableName: "gallery",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Gallery;
};
