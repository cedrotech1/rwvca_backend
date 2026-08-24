'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_report_items', {
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
      timber_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      category: {
        type: Sequelize.ENUM("NORMAL", "OTHER"),
        allowNull: true,
        defaultValue: null,
      },
      number_of_timber: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      total_cost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      vat: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      msf: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      mst: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      vat_and_msf: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: null,
      },
      vat_and_mst: {
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
    await queryInterface.addIndex("membership_report_items", ["report_id"], { name: "membership_report_items_report_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_report_items');
  },
};
