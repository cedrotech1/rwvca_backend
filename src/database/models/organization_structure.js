"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class OrganizationStructure extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  OrganizationStructure.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      unit_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      unit_key: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      level: {
        type: DataTypes.ENUM("top", "middle", "bottom"),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      is_active: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
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
      modelName: "OrganizationStructure",
      tableName: "organization_structure",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return OrganizationStructure;
};
