"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class EventImages extends Model {
    static associate(models) {
      EventImages.belongsTo(models.Events, { foreignKey: "eid", as: "event" });
    }
  }

  EventImages.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      eid: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "EventImages",
      tableName: "event_images",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return EventImages;
};
