"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("employee_plan_logs", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "employee_plans", key: "id" },
        onDelete: "SET NULL",
      },
      report_id: { type: Sequelize.INTEGER, allowNull: true },
      action: { type: Sequelize.STRING(80), allowNull: false },
      detail: { type: Sequelize.TEXT, allowNull: true },
      changed_by: { type: Sequelize.INTEGER, allowNull: true },
      meta: { type: Sequelize.TEXT, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("employee_plan_logs", ["plan_id"], {
      name: "employee_plan_logs_plan_id_idx",
    });
    await queryInterface.addIndex("employee_plan_logs", ["changed_by"], {
      name: "employee_plan_logs_changed_by_idx",
    });
    await queryInterface.addIndex("employee_plan_logs", ["created_at"], {
      name: "employee_plan_logs_created_at_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employee_plan_logs");
  },
};
