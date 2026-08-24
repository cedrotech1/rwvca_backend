'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_attributes', {
      attribute_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      service_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      is_available: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      }
    });
    await queryInterface.addIndex("membership_attributes", ["category_id","service_id"], { unique: true, name: "membership_attributes_unique_category_service" });
    await queryInterface.addIndex("membership_attributes", ["service_id"], { name: "membership_attributes_service_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_attributes');
  },
};
