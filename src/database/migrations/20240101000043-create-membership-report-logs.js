'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_report_logs', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("CREATED", "UPDATED", "SUBMITTED", "APPROVED", "REVERTED", "VIEWED", "ASSIGNED", "REVIEWED", "REMOVED"),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("membership_report_logs", ["report_id"], { name: "membership_report_logs_report_id" });
    await queryInterface.addIndex("membership_report_logs", ["user_id"], { name: "membership_report_logs_user_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_report_logs');
  },
};
