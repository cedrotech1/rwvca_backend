"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Communications extends Model {
    static associate(models) {
      Communications.hasMany(models.CommunicationAttachments, { foreignKey: "communication_id", as: "communication_attachments_communication_id" });
      Communications.hasMany(models.CommunicationReplies, { foreignKey: "communication_id", as: "communication_replies_communication_id" });
      Communications.belongsTo(models.Users, { foreignKey: "created_by", as: "creator" });
    }
  }

  Communications.init(
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
      communication_type: {
        type: DataTypes.ENUM("general", "permission"),
        allowNull: false,
        defaultValue: "general",
      },
      users: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      viewed_users: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      start_time: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      end_time: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      attachment_url: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: null,
      },
      link: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "Communications",
      tableName: "communications",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Communications;
};
