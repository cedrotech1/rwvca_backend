'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attendance', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      attendance_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      status: {
        type: Sequelize.ENUM("draft", "active", "cancelled", "completed"),
        allowNull: true,
        defaultValue: "active",
      }
    });
    await queryInterface.addIndex("attendance", ["created_by"], { name: "attendance_created_by" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('attendance');
  },
};
