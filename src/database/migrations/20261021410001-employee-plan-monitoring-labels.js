"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE privileges
      SET name = 'Employee plan monitoring (all staff)',
          description = 'See organization-wide employee plan monitoring; everyone already has My plans monitoring'
      WHERE code = 'menu.staff_monitoring'
    `);
    await queryInterface.sequelize.query(`
      UPDATE privileges
      SET name = 'Employee plan monitoring (all staff)',
          description = 'View and manage plans across all staff on Employee plan monitoring'
      WHERE code = 'plans.monitor'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE privileges
      SET name = 'Staff Monitoring (all staff)',
          description = 'See organization-wide staff monitoring; everyone already has their own dashboard'
      WHERE code = 'menu.staff_monitoring'
    `);
    await queryInterface.sequelize.query(`
      UPDATE privileges
      SET name = 'Monitor all staff plans',
          description = 'View and manage plans across all staff on the monitoring dashboard'
      WHERE code = 'plans.monitor'
    `);
  },
};
