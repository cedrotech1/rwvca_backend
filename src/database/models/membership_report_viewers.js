"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipReportViewers extends Model {
    static associate(models) {
      MembershipReportViewers.belongsTo(models.Reports, { foreignKey: "report_id", as: "report" });
      MembershipReportViewers.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  MembershipReportViewers.init(
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
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      viewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "MembershipReportViewers",
      tableName: "membership_report_viewers",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return MembershipReportViewers;
};
