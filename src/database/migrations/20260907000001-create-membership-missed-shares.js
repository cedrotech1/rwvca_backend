'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_missed_shares', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      shared_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shared_to: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      filters: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      link_path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      opened_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('membership_missed_shares', ['shared_by'], { name: 'membership_missed_shares_shared_by' });
    await queryInterface.addIndex('membership_missed_shares', ['shared_to'], { name: 'membership_missed_shares_shared_to' });
    await queryInterface.addIndex('membership_missed_shares', ['status'], { name: 'membership_missed_shares_status' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_missed_shares');
  },
};
