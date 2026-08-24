"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Team extends Model {
    static associate(models) {
      // associations defined from PHP schema foreign-key columns
    }
  }

  Team.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      names: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      image: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: null,
      },
      bio: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      role: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      active: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      resetcode: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      deleted: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "no",
      }
    },
    {
      sequelize,
      modelName: "Team",
      tableName: "team",
      timestamps: false,
      createdAt: false,
      updatedAt: false,
    }
  );

  return Team;
};
