'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_tasks', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      is_completed: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
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
      from_datetime: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      to_datetime: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      priority: {
        type: Sequelize.ENUM("Low", "Medium", "High", "Urgent"),
        allowNull: true,
        defaultValue: "Medium",
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      is_shared: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      shared_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      shared_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      }
    });
    await queryInterface.addIndex("user_tasks", ["user_id"], { name: "user_tasks_idx_user_tasks_owner" });
    await queryInterface.addIndex("user_tasks", ["is_shared","shared_by"], { name: "user_tasks_idx_user_tasks_shared" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_tasks');
  },
};
