'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('notifications', 'priority', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'middle',
    });
    await queryInterface.addIndex('notifications', ['priority'], {
      name: 'notifications_priority',
    });
    await queryInterface.addIndex('notifications', ['receiver_id', 'priority', 'status'], {
      name: 'notifications_receiver_priority_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notifications', 'notifications_receiver_priority_status');
    await queryInterface.removeIndex('notifications', 'notifications_priority');
    await queryInterface.removeColumn('notifications', 'priority');
  },
};
