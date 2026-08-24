"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EdModuleComments extends Model {
    static associate(models) {
      EdModuleComments.belongsTo(models.EdModuleComments, { foreignKey: "parent_id", as: "parent" });
      EdModuleComments.hasMany(models.EdModuleComments, { foreignKey: "parent_id", as: "replies" });
      EdModuleComments.belongsTo(models.Users, { foreignKey: "user_id", as: "user" });
      EdModuleComments.hasMany(models.EdCommentRecipients, { foreignKey: "comment_id", as: "recipients" });
    }
  }

  EdModuleComments.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      module_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      record_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
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
      modelName: "EdModuleComments",
      tableName: "ed_module_comments",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return EdModuleComments;
};
