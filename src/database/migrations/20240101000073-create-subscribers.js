'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscribers', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      subscribed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      status: {
        type: Sequelize.ENUM("active", "unsubscribed", "bounced"),
        allowNull: true,
        defaultValue: "active",
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
        defaultValue: null,
      },
      source: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: "footer",
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("subscribers", ["email"], { unique: true, name: "subscribers_email" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('subscribers');
  },
};
