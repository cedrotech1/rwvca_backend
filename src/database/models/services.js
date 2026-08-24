"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Services extends Model {
    static associate(models) {
      Services.hasMany(models.MembershipAttributes, { foreignKey: "service_id", as: "membership_attributes_service_id" });
    }
  }

  Services.init(
    {
      service_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      service_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      }
    },
    {
      sequelize,
      modelName: "Services",
      tableName: "services",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return Services;
};
