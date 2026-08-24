"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EdCommentRecipients extends Model {
    static associate(models) {
      EdCommentRecipients.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
      EdCommentRecipients.belongsTo(models.EdModuleComments, { foreignKey: "comment_id", as: "comment" });
    }
  }

  EdCommentRecipients.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      comment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      module_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      record_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      replied_at: {
        type: DataTypes.DATE,
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
      modelName: "EdCommentRecipients",
      tableName: "ed_comment_recipients",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return EdCommentRecipients;
};
