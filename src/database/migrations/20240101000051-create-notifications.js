'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      receiver_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("unread", "read"),
        allowNull: true,
        defaultValue: "unread",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      user_type: {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: null,
      },
      link: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};
