'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('todo_shares', {
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
      shared_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shared_with: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      permission: {
        type: Sequelize.ENUM("view", "edit", "complete"),
        allowNull: true,
        defaultValue: "view",
      },
      status: {
        type: Sequelize.ENUM("pending", "accepted", "declined"),
        allowNull: true,
        defaultValue: "pending",
      },
      shared_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      responded_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      comments: {
        type: Sequelize.TEXT,
        allowNull: true,
      }
    });
    await queryInterface.addIndex("todo_shares", ["task_id","shared_with"], { unique: true, name: "todo_shares_unique_share" });
    await queryInterface.addIndex("todo_shares", ["shared_by"], { name: "todo_shares_shared_by" });
    await queryInterface.addIndex("todo_shares", ["task_id"], { name: "todo_shares_idx_todo_shares_task" });
    await queryInterface.addIndex("todo_shares", ["shared_with","status"], { name: "todo_shares_idx_todo_shares_with" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('todo_shares');
  },
};
