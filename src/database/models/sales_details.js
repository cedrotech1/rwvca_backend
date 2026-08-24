"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SalesDetails extends Model {
    static associate(models) {
      SalesDetails.belongsTo(models.Members, { foreignKey: "member_id", as: "member" });
    }
  }

  SalesDetails.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      member_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      products: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      cluster: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "SalesDetails",
      tableName: "sales_details",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return SalesDetails;
};
