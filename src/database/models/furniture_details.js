"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class FurnitureDetails extends Model {
    static associate(models) {
      FurnitureDetails.belongsTo(models.Members, { foreignKey: "member_id", as: "member" });
    }
  }

  FurnitureDetails.init(
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
      modelName: "FurnitureDetails",
      tableName: "furniture_details",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return FurnitureDetails;
};
