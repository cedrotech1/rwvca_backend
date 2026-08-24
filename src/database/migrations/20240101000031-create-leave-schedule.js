'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leave_schedule', {
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
      from_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      return_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      hr_read_status: {
        type: Sequelize.ENUM("unread", "read"),
        allowNull: false,
        defaultValue: "unread",
      },
      ed_read_status: {
        type: Sequelize.ENUM("unread", "read"),
        allowNull: false,
        defaultValue: "unread",
      },
      hr_read_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      ed_read_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      status_changed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status_changed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      last_reply_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      last_reply_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      unread_reply_count: {
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
    await queryInterface.addIndex("leave_schedule", ["user_id"], { name: "leave_schedule_idx_user_id" });
    await queryInterface.addIndex("leave_schedule", ["from_date","return_date"], { name: "leave_schedule_idx_dates" });
    await queryInterface.addIndex("leave_schedule", ["status"], { name: "leave_schedule_idx_status" });
    await queryInterface.addIndex("leave_schedule", ["hr_read_status"], { name: "leave_schedule_idx_hr_read_status" });
    await queryInterface.addIndex("leave_schedule", ["ed_read_status"], { name: "leave_schedule_idx_ed_read_status" });
    await queryInterface.addIndex("leave_schedule", ["status_changed_by"], { name: "leave_schedule_idx_status_changed_by" });
    await queryInterface.addIndex("leave_schedule", ["last_reply_at"], { name: "leave_schedule_idx_last_reply_at" });
    await queryInterface.addIndex("leave_schedule", ["unread_reply_count"], { name: "leave_schedule_idx_unread_reply_count" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leave_schedule');
  },
};
