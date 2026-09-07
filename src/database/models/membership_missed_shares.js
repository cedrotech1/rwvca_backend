"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipMissedShares extends Model {
    static associate(models) {
      MembershipMissedShares.belongsTo(models.Users, { foreignKey: "shared_by", as: "sharer" });
      MembershipMissedShares.belongsTo(models.Users, { foreignKey: "shared_to", as: "recipient" });
      MembershipMissedShares.hasMany(models.MembershipMissedShareComments, {
        foreignKey: "share_id",
        as: "comments",
      });
    }
  }

  MembershipMissedShares.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      shared_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      shared_to: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      filters: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      snapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      link_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "PENDING",
      },
      opened_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      seen_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "MembershipMissedShares",
      tableName: "membership_missed_shares",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return MembershipMissedShares;
};
