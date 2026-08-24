"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TicketReplies extends Model {
    static associate(models) {
      TicketReplies.belongsTo(models.Tickets, { foreignKey: "ticket_id", as: "ticket" });
      TicketReplies.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  TicketReplies.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      attachments: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      is_status_update: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      new_status: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "TicketReplies",
      tableName: "ticket_replies",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return TicketReplies;
};
