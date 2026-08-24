"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MemberProducts extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  MemberProducts.init(
    {
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      product_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      company_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      website_url: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null,
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      image1_url: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null,
      },
      image2_url: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null,
      },
      image3_url: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null,
      },
      is_active: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
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
      modelName: "MemberProducts",
      tableName: "member_products",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return MemberProducts;
};
