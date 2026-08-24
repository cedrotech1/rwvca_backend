'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('special_requisition_logs', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      special_requisition_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      changed_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("special_requisition_logs", ["special_requisition_id"], { name: "special_requisition_logs_idx_srl_req" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('special_requisition_logs');
  },
};
