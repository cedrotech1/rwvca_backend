"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SpecialRequisitionLogs extends Model {
    static associate(models) {
      SpecialRequisitionLogs.belongsTo(models.SpecialRequisitions, { foreignKey: "special_requisition_id", as: "special_requisition" });
      SpecialRequisitionLogs.belongsTo(models.Users, { foreignKey: "changed_by", as: "changedByUser" });
    }
  }

  SpecialRequisitionLogs.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      special_requisition_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(100),
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
      modelName: "SpecialRequisitionLogs",
      tableName: "special_requisition_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return SpecialRequisitionLogs;
};
