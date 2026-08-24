'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('nursery_details', {
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
      land_size: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
      },
      seed_type: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      seed_quantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      land_ownership: {
        type: Sequelize.ENUM("Owned", "Rented"),
        allowNull: true,
        defaultValue: null,
      }
    });
    await queryInterface.addIndex("nursery_details", ["member_id"], { name: "nursery_details_member_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('nursery_details');
  },
};
