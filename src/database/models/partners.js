"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Partners extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  Partners.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      logo_url: {
        type: DataTypes.STRING(100),
        allowNull: false,
      }
    },
    {
      sequelize,
      modelName: "Partners",
      tableName: "partners",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return Partners;
};
