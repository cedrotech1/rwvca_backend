"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ReportRecipient extends Model {
    static associate(models) {
      ReportRecipient.belongsTo(models.Reports, { foreignKey: "report_id", as: "report" });
    }
  }

  ReportRecipient.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      recipient_type: {
        type: DataTypes.ENUM("user", "department"),
        allowNull: false,
      },
      recipient_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assigned_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      read_status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "ReportRecipient",
      tableName: "report_recipient",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return ReportRecipient;
};
