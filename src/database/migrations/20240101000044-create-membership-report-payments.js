'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_report_payments', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      method: {
        type: Sequelize.ENUM("MOMO", "CASH", "BANK", "NOT_INVOICED", "MEMBERSHIP_FEES_REGISTRETION", "MEMBERSHIP_FEES_CONTRIBUTION"),
        allowNull: true,
        defaultValue: null,
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("membership_report_payments", ["report_id"], { name: "membership_report_payments_report_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_report_payments');
  },
};
