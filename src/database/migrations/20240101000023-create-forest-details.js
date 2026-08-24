'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('forest_details', {
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
      forest_area: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
      },
      forest_type: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      }
    });
    await queryInterface.addIndex("forest_details", ["member_id"], { name: "forest_details_member_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('forest_details');
  },
};
