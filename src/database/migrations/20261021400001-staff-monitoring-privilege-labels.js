"use strict";

/** Clarify that staff monitoring privilege = all-staff view (personal dashboard is always available). */
module.exports = {
  async up(queryInterface) {
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

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE privileges SET name = 'Staff Monitoring', description = NULL WHERE code = 'menu.staff_monitoring'
    `);
    await queryInterface.sequelize.query(`
      UPDATE privileges SET name = 'Monitor staff plans', description = NULL WHERE code = 'plans.monitor'
    `);
  },
};
