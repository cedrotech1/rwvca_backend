"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Documents extends Model {
    static associate(models) {
      Documents.hasMany(models.DocumentComments, { foreignKey: "document_id", as: "document_comments_document_id" });
      Documents.hasMany(models.DocumentShares, { foreignKey: "document_id", as: "document_shares_document_id" });
      Documents.belongsTo(models.Users, { foreignKey: "created_by", as: "creator" });
    }
  }

  Documents.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "general",
      },
      file_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pdf",
      },
      file_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("open", "closed"),
        allowNull: false,
        defaultValue: "open",
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
      modelName: "Documents",
      tableName: "documents",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Documents;
};
