'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_reports', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_type: {
        type: Sequelize.ENUM("DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"),
        allowNull: true,
        defaultValue: null,
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      month: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      quarter: {
        type: Sequelize.STRING(11),
        allowNull: true,
        defaultValue: null,
      },
      week: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      location: {
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
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      monthly_month: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      yearly_year: {
        type: Sequelize.STRING(30),
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: Sequelize.ENUM("PENDING", "APPROVED", "REVERTED"),
        allowNull: true,
        defaultValue: "PENDING",
      },
      submitted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      approved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      }
    });
    await queryInterface.addIndex("membership_reports", ["user_id"], { name: "membership_reports_user_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_reports');
  },
};
