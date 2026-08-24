"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipReportItems extends Model {
    static associate(models) {
      MembershipReportItems.belongsTo(models.Reports, { foreignKey: "report_id", as: "report" });
    }
  }

  MembershipReportItems.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      timber_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      category: {
        type: DataTypes.ENUM("NORMAL", "OTHER"),
        allowNull: true,
        defaultValue: null,
      },
      number_of_timber: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      total_cost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      vat: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      msf: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      mst: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      vat_and_msf: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      vat_and_mst: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "MembershipReportItems",
      tableName: "membership_report_items",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return MembershipReportItems;
};
