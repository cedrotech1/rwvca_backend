"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ForestDetails extends Model {
    static associate(models) {
      ForestDetails.belongsTo(models.Members, { foreignKey: "member_id", as: "member" });
    }
  }

  ForestDetails.init(
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
      forest_area: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
      },
      forest_type: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "ForestDetails",
      tableName: "forest_details",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return ForestDetails;
};
