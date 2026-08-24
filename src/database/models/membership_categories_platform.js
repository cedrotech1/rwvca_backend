"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipCategoriesPlatform extends Model {
    static associate(models) {
      MembershipCategoriesPlatform.hasMany(models.Members, {
        foreignKey: "membership_category_platform_id",
        as: "members",
      });
    }
  }

  MembershipCategoriesPlatform.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      }
    },
    {
      sequelize,
      modelName: "MembershipCategoriesPlatform",
      tableName: "membership_categories_platform",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return MembershipCategoriesPlatform;
};
