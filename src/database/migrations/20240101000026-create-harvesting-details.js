'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('harvesting_details', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      member_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      cluster: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      }
    });
    await queryInterface.addIndex("harvesting_details", ["member_id"], { name: "harvesting_details_member_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('harvesting_details');
  },
};
