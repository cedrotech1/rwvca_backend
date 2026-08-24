"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipAttributes extends Model {
    static associate(models) {
      MembershipAttributes.belongsTo(models.Services, { foreignKey: "service_id", as: "service" });
      MembershipAttributes.belongsTo(models.MembershipCategories, { foreignKey: "category_id", as: "category" });
    }
  }

  MembershipAttributes.init(
    {
      attribute_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      service_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      is_available: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      }
    },
    {
      sequelize,
      modelName: "MembershipAttributes",
      tableName: "membership_attributes",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return MembershipAttributes;
};
