"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Members extends Model {
    static associate(models) {
      Members.hasMany(models.ForestDetails, { foreignKey: "member_id", as: "forest_details_member_id" });
      Members.hasMany(models.FurnitureDetails, { foreignKey: "member_id", as: "furniture_details_member_id" });
      Members.hasMany(models.HarvestingDetails, { foreignKey: "member_id", as: "harvesting_details_member_id" });
      Members.hasMany(models.MemberYearPayments, { foreignKey: "member_id", as: "member_year_payments_member_id" });
      Members.hasMany(models.NurseryDetails, { foreignKey: "member_id", as: "nursery_details_member_id" });
      Members.hasMany(models.SalesDetails, { foreignKey: "member_id", as: "sales_details_member_id" });
      Members.belongsTo(models.MembershipCategoriesPlatform, {
        foreignKey: "membership_category_platform_id",
        as: "platformCategory",
      });
    }
  }

  Members.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      company_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      owner_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      shareholder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      gender: {
        type: DataTypes.ENUM("Male", "Female"),
        allowNull: true,
        defaultValue: null,
      },
      rdb_certificate: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      tin: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      national_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      province: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      district: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      role: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      has_rwvca_role: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      rwvca_role: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      membership_category_platform_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      membership_status: {
        type: DataTypes.ENUM("Paid", "Not Paid", "Partial"),
        allowNull: true,
        defaultValue: null,
      },
      registration_status: {
        type: DataTypes.ENUM("Paid", "Not Paid"),
        allowNull: true,
        defaultValue: "Not Paid",
      },
      registration_paid_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      employees_women: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      employees_men: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      employees_pwd: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null,
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      date_joined: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      is_active: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      membership_category: {
        type: DataTypes.STRING(100),
        allowNull: false,
      }
    },
    {
      sequelize,
      modelName: "Members",
      tableName: "members",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return Members;
};
