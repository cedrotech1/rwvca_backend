'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leave_requests', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      leave_type: {
        type: Sequelize.ENUM("Annual", "Compassionate", "Others"),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      leave_from: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      return_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      requested_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      carry_over_days_used: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      current_year_days_used: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      carry_over_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      current_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      days_authorized: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      remaining_days: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      applied_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      applicant_signature: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      hr_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      hr_verification_status: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: "pending",
      },
      hr_verified_at: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      hr_signature: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      executive_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      chairman_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      executive_verification_status: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: "pending",
      },
      executive_approved_at: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      executive_signature: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      leave_requests_status: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: "pending",
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
      letter_url: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      ed_signature_and_stamp: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "no",
      },
      current_year_val: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      balance_updated: {
        type: Sequelize.SMALLINT,
        allowNull: true,
        defaultValue: 0,
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leave_requests');
  },
};
