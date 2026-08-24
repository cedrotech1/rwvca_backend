'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leave_schedule_replies', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      leave_schedule_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      sender_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      receiver_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      reply_type: {
        type: Sequelize.ENUM("comment", "question", "answer", "approval_comment", "rejection_reason"),
        allowNull: true,
        defaultValue: "comment",
      },
      is_internal: {
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
      }
    });
    await queryInterface.addIndex("leave_schedule_replies", ["leave_schedule_id"], { name: "leave_schedule_replies_idx_leave_schedule_id" });
    await queryInterface.addIndex("leave_schedule_replies", ["sender_id"], { name: "leave_schedule_replies_idx_sender_id" });
    await queryInterface.addIndex("leave_schedule_replies", ["receiver_id"], { name: "leave_schedule_replies_idx_receiver_id" });
    await queryInterface.addIndex("leave_schedule_replies", ["reply_type"], { name: "leave_schedule_replies_idx_reply_type" });
    await queryInterface.addIndex("leave_schedule_replies", ["created_at"], { name: "leave_schedule_replies_idx_created_at" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leave_schedule_replies');
  },
};
