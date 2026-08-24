"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipCategories extends Model {
    static associate(models) {
      MembershipCategories.hasMany(models.Fees, { foreignKey: "category_id", as: "fees" });
      MembershipCategories.hasMany(models.MembershipAttributes, { foreignKey: "category_id", as: "attributes" });
    }
  }

  MembershipCategories.init(
    {
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      category_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "MembershipCategories",
      tableName: "membership_categories",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return MembershipCategories;
};
