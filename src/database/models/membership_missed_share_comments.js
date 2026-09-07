"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class MembershipMissedShareComments extends Model {
    static associate(models) {
      MembershipMissedShareComments.belongsTo(models.MembershipMissedShares, {
        foreignKey: "share_id",
        as: "share",
      });
      MembershipMissedShareComments.belongsTo(models.Users, {
        foreignKey: "user_id",
        as: "user",
      });
    }
  }

  MembershipMissedShareComments.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      share_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "MembershipMissedShareComments",
      tableName: "membership_missed_share_comments",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return MembershipMissedShareComments;
};
