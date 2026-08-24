"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipYears extends Model {
    static associate(models) {
      MembershipYears.hasMany(models.MemberYearPayments, { foreignKey: "year_id", as: "member_year_payments_year_id" });
    }
  }

  MembershipYears.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      year_value: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      is_active: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "MembershipYears",
      tableName: "membership_years",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return MembershipYears;
};
