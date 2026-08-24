"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Tickets extends Model {
    static associate(models) {
      Tickets.hasMany(models.TicketLogs, { foreignKey: "ticket_id", as: "ticket_logs_ticket_id" });
      Tickets.hasMany(models.TicketReplies, { foreignKey: "ticket_id", as: "ticket_replies_ticket_id" });
      Tickets.belongsTo(models.Users, { foreignKey: "created_by", as: "creator" });
      Tickets.belongsTo(models.Users, { foreignKey: "assigned_to", as: "assignee" });
    }
  }

  Tickets.init(
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
      status: {
        type: DataTypes.ENUM("open", "in_progress", "pending", "resolved", "closed"),
        allowNull: false,
        defaultValue: "open",
      },
      priority: {
        type: DataTypes.ENUM("low", "medium", "high", "urgent"),
        allowNull: false,
        defaultValue: "medium",
      },
      assigned_to: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "general",
      },
      attachments: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "Tickets",
      tableName: "tickets",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Tickets;
};
