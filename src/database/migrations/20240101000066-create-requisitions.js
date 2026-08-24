'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('requisitions', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      department_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      budget_source: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      account_code: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      total_amount_requested: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      amount_in_words: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      prepared_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      sended_to: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      verified_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      verified_at: {
        type: Sequelize.DATE,
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
      },
      status: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: "",
      },
      rejection_reason: {
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
      viewer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      viewer_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      viewer_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      viewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reverted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      reverted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      reversion_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      submitted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      verification_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      approval_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      rejected_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      rejected_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      finance_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      authorized_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      authorized_at: {
        type: Sequelize.DATE,
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
    await queryInterface.dropTable('requisitions');
  },
};
