"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class HarvestingDetails extends Model {
    static associate(models) {
      HarvestingDetails.belongsTo(models.Members, { foreignKey: "member_id", as: "member" });
    }
  }

  HarvestingDetails.init(
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
      cluster: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "HarvestingDetails",
      tableName: "harvesting_details",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return HarvestingDetails;
};
