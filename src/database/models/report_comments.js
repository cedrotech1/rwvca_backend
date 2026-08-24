"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ReportComments extends Model {
    static associate(models) {
      ReportComments.belongsTo(models.Reports, { foreignKey: "report_id", as: "report" });
      ReportComments.belongsTo(models.ReportComments, { foreignKey: "parent_id", as: "parent" });
      ReportComments.hasMany(models.ReportComments, { foreignKey: "parent_id", as: "report_comments_parent_id" });
      ReportComments.belongsTo(models.Users, { foreignKey: "created_by", as: "creator" });
    }
  }

  ReportComments.init(
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
      parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      created_by: {
        type: DataTypes.INTEGER,
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
      }
    },
    {
      sequelize,
      modelName: "ReportComments",
      tableName: "report_comments",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return ReportComments;
};
