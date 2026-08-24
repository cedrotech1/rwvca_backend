"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipApplicationSettings extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  MembershipApplicationSettings.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      application_link: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      is_active: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "MembershipApplicationSettings",
      tableName: "membership_application_settings",
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    }
  );

  return MembershipApplicationSettings;
};
