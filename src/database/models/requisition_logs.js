"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RequisitionLogs extends Model {
    static associate(models) {
      RequisitionLogs.belongsTo(models.Requisitions, { foreignKey: "requisition_id", as: "requisition" });
      RequisitionLogs.belongsTo(models.Users, { foreignKey: "changed_by", as: "changedByUser" });
    }
  }

  RequisitionLogs.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      requisition_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      changed_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      comment: {
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
      modelName: "RequisitionLogs",
      tableName: "requisition_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return RequisitionLogs;
};
