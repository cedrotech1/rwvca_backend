"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Subscribers extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  Subscribers.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      subscribed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.ENUM("active", "unsubscribed", "bounced"),
        allowNull: true,
        defaultValue: "active",
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        defaultValue: null,
      },
      source: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "footer",
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "Subscribers",
      tableName: "subscribers",
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    }
  );

  return Subscribers;
};
