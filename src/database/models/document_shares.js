"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DocumentShares extends Model {
    static associate(models) {
      DocumentShares.belongsTo(models.Documents, { foreignKey: "document_id", as: "document" });
      DocumentShares.belongsTo(models.Users, { foreignKey: "shared_by", as: "sharedByUser" });
      DocumentShares.belongsTo(models.Users, { foreignKey: "shared_to", as: "sharedToUser" });
    }
  }

  DocumentShares.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      document_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      shared_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      shared_to: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      shared_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      is_forward: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      }
    },
    {
      sequelize,
      modelName: "DocumentShares",
      tableName: "document_shares",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return DocumentShares;
};
