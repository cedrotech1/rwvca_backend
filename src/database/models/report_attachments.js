"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ReportAttachments extends Model {
    static associate(models) {
      ReportAttachments.belongsTo(models.Reports, { foreignKey: "report_id", as: "report" });
    }
  }

  ReportAttachments.init(
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
      file_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      file_path: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      uploaded_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      file_size: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      uploaded_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "ReportAttachments",
      tableName: "report_attachments",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return ReportAttachments;
};
