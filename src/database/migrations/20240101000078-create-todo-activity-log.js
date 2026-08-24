'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('todo_activity_log', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      action: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("todo_activity_log", ["task_id","created_at"], { name: "todo_activity_log_idx_task_activity" });
    await queryInterface.addIndex("todo_activity_log", ["user_id","created_at"], { name: "todo_activity_log_idx_user_activity" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('todo_activity_log');
  },
};
