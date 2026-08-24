'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mission_requests', {
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
      destination: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      departure_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      return_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      days_requested: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      days_authorized: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      hr_id: {
        type: Sequelize.INTEGER,
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
      mission_requests_status: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "pending",
      },
      hr_verification_status: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "pending",
      },
      hr_signature: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      hr_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      executive_verification_status: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: "pending",
      },
      executive_signature: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      executive_approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
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
      submitted_by_hr: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      vihicle_prack: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      ed_signature_and_stamp: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "no",
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mission_requests');
  },
};
