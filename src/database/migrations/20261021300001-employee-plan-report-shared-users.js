"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("employee_plan_reports");
    if (!table.shared_user_ids) {
      await queryInterface.addColumn("employee_plan_reports", "shared_user_ids", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("employee_plan_reports");
    if (table.shared_user_ids) {
      await queryInterface.removeColumn("employee_plan_reports", "shared_user_ids");
    }
  },
};
