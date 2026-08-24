'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('document_shares', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      document_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shared_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shared_to: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shared_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      is_forward: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('document_shares');
  },
};
