"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CompanyInfo extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  CompanyInfo.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      company_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      website: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      facebook: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      twitter: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      instagram: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      linkedin: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      youtube: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      logo: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "CompanyInfo",
      tableName: "company_info",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return CompanyInfo;
};
