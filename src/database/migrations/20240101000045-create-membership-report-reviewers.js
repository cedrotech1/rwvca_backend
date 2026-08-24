'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_report_reviewers', {
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
      reviewer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      assigned_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: Sequelize.ENUM("PENDING", "REVIEWED", "APPROVED", "REJECTED"),
        allowNull: true,
        defaultValue: "PENDING",
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("membership_report_reviewers", ["report_id"], { name: "membership_report_reviewers_report_id" });
    await queryInterface.addIndex("membership_report_reviewers", ["reviewer_id"], { name: "membership_report_reviewers_reviewer_id" });
    await queryInterface.addIndex("membership_report_reviewers", ["assigned_by"], { name: "membership_report_reviewers_assigned_by" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_report_reviewers');
  },
};
