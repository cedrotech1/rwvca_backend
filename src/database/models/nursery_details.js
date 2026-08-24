"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class NurseryDetails extends Model {
    static associate(models) {
      NurseryDetails.belongsTo(models.Members, { foreignKey: "member_id", as: "member" });
    }
  }

  NurseryDetails.init(
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
      land_size: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
      },
      seed_type: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      seed_quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      land_ownership: {
        type: DataTypes.ENUM("Owned", "Rented"),
        allowNull: true,
        defaultValue: null,
      }
    },
    {
      sequelize,
      modelName: "NurseryDetails",
      tableName: "nursery_details",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return NurseryDetails;
};
