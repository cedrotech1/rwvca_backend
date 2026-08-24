'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('partners', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      logo_url: {
        type: Sequelize.STRING(100),
        allowNull: false,
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('partners');
  },
};
