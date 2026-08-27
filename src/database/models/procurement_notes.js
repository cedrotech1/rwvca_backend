"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ProcurementNotes extends Model {
    static associate(models) {
      ProcurementNotes.belongsTo(models.Procurements, {
        foreignKey: "procurement_id",
        as: "procurement",
      });
      ProcurementNotes.belongsTo(models.Users, {
        foreignKey: "created_by",
        as: "author",
      });
    }
  }

  ProcurementNotes.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      procurement_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      note: {
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
      },
    },
    {
      sequelize,
      modelName: "ProcurementNotes",
      tableName: "procurement_notes",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return ProcurementNotes;
};
