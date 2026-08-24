'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('todo_comments', {
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
      comment: {
        type: Sequelize.TEXT,
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
      }
    });
    await queryInterface.addIndex("todo_comments", ["user_id"], { name: "todo_comments_user_id" });
    await queryInterface.addIndex("todo_comments", ["task_id"], { name: "todo_comments_idx_todo_comments_task" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('todo_comments');
  },
};
