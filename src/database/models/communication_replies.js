"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CommunicationReplies extends Model {
    static associate(models) {
      CommunicationReplies.belongsTo(models.Communications, { foreignKey: "communication_id", as: "communication" });
      CommunicationReplies.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  CommunicationReplies.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      communication_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      reply_text: {
        type: DataTypes.TEXT,
        allowNull: false,
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
      parent_reply_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.ENUM("active", "deleted"),
        allowNull: true,
        defaultValue: "active",
      }
    },
    {
      sequelize,
      modelName: "CommunicationReplies",
      tableName: "communication_replies",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return CommunicationReplies;
};
