"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TicketLogs extends Model {
    static associate(models) {
      TicketLogs.belongsTo(models.Tickets, { foreignKey: "ticket_id", as: "ticket" });
      TicketLogs.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  TicketLogs.init(
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
      action: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "TicketLogs",
      tableName: "ticket_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return TicketLogs;
};
