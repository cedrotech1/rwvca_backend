'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE leave_requests
      ALTER COLUMN leave_type TYPE VARCHAR(100)
      USING leave_type::text;
    `);
  },

  async down() {
    // Keep VARCHAR so PHP leave reasons remain valid.
  },
};
