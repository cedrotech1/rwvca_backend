'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tickets', {
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
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("open", "in_progress", "pending", "resolved", "closed"),
        allowNull: false,
        defaultValue: "open",
      },
      priority: {
        type: Sequelize.ENUM("low", "medium", "high", "urgent"),
        allowNull: false,
        defaultValue: "medium",
      },
      assigned_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: "general",
      },
      attachments: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tickets');
  },
};
