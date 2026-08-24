"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RequisitionStatusLog extends Model {
    static associate(models) {
      RequisitionStatusLog.belongsTo(models.Requisitions, { foreignKey: "requisition_id", as: "requisition" });
    }
  }

  RequisitionStatusLog.init(
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
      comments: {
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
      modelName: "RequisitionStatusLog",
      tableName: "requisition_status_log",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return RequisitionStatusLog;
};
