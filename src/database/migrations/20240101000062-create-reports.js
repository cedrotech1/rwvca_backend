'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reports', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      period_start: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      period_end: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
      time_from: {
        type: Sequelize.TIME,
        allowNull: true,
        defaultValue: null,
      },
      time_to: {
        type: Sequelize.TIME,
        allowNull: true,
        defaultValue: null,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      }
    });
    await queryInterface.addIndex("reports", ["created_by"], { name: "reports_idx_created_by" });
    await queryInterface.addIndex("reports", ["type","created_at"], { name: "reports_idx_type_created" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reports');
  },
};
