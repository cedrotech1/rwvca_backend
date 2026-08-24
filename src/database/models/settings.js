"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Settings extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  Settings.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      leave_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 21,
      },
      send_email_notification: {
        type: DataTypes.STRING(5),
        allowNull: true,
        defaultValue: "yes",
      },
      system_status: {
        type: DataTypes.ENUM("live", "maintenance", "offline"),
        allowNull: false,
        defaultValue: "live",
      },
      export_db_password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      stamp_with_signature: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      signature_only: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: "",
      }
    },
    {
      sequelize,
      modelName: "Settings",
      tableName: "settings",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return Settings;
};
