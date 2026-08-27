"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Procurements extends Model {
    static associate(models) {
      Procurements.belongsTo(models.Users, { foreignKey: "created_by", as: "creator" });
      Procurements.belongsTo(models.Users, { foreignKey: "updated_by", as: "updater" });
      Procurements.hasMany(models.ProcurementDocuments, {
        foreignKey: "procurement_id",
        as: "documents",
      });
      Procurements.hasMany(models.ProcurementNotes, {
        foreignKey: "procurement_id",
        as: "notes_list",
      });
    }
  }

  Procurements.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      reference_no: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      supplier_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      amount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
        defaultValue: 0,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "RWF",
      },
      status: {
        type: DataTypes.ENUM("draft", "recorded", "in_progress", "completed", "cancelled"),
        allowNull: false,
        defaultValue: "recorded",
      },
      requested_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      expected_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      completed_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
    },
    {
      sequelize,
      modelName: "Procurements",
      tableName: "procurements",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Procurements;
};
