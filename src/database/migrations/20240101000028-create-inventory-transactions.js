'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_transactions', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM("in", "out"),
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      transaction_date: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("inventory_transactions", ["item_id"], { name: "inventory_transactions_item_id" });
    await queryInterface.addIndex("inventory_transactions", ["user_id"], { name: "inventory_transactions_user_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inventory_transactions');
  },
};
