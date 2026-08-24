"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Programs extends Model {
    static associate(models) {
      Programs.hasMany(models.ProgramImages, { foreignKey: "pid", as: "images" });
    }
  }

  Programs.init(
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
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      application_deadline: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      requirements: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      why_apply: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      application_link: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      category: {
        type: DataTypes.ENUM("upcoming", "recent", "main"),
        allowNull: false,
        defaultValue: "upcoming",
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
      modelName: "Programs",
      tableName: "programs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Programs;
};
