"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DocumentComments extends Model {
    static associate(models) {
      DocumentComments.belongsTo(models.Documents, { foreignKey: "document_id", as: "document" });
      DocumentComments.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
    }
  }

  DocumentComments.init(
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
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      parent_comment_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      comment_text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      commented_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "DocumentComments",
      tableName: "document_comments",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return DocumentComments;
};
