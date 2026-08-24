'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('fees', {
      fee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fee_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: "RWF",
      }
    });
    await queryInterface.addIndex("fees", ["category_id"], { name: "fees_category_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('fees');
  },
};
