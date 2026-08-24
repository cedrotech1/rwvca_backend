'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('furniture_details', {
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
      products: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cluster: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      }
    });
    await queryInterface.addIndex("furniture_details", ["member_id"], { name: "furniture_details_member_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('furniture_details');
  },
};
