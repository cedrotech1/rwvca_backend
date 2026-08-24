"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EdCommentEdSeen extends Model {
    static associate(models) {
      EdCommentEdSeen.belongsTo(models.Users, { foreignKey: "ed_user_id", as: "ed_user" });
    }
  }

  EdCommentEdSeen.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      ed_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      root_comment_id: {
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
      seen_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      last_reply_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "EdCommentEdSeen",
      tableName: "ed_comment_ed_seen",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return EdCommentEdSeen;
};
