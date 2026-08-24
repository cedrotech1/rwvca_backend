'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('report_recipient', {
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
      recipient_type: {
        type: Sequelize.ENUM("user", "department"),
        allowNull: false,
      },
      recipient_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      read_status: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      }
    });
    await queryInterface.addIndex("report_recipient", ["report_id","recipient_type","recipient_id"], { unique: true, name: "report_recipient_uk_report_recipient" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('report_recipient');
  },
};
