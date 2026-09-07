'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('membership_missed_shares', 'seen_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.createTable('membership_missed_share_comments', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      share_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: false,
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

    await queryInterface.addIndex('membership_missed_share_comments', ['share_id'], {
      name: 'membership_missed_share_comments_share_id',
    });
    await queryInterface.addIndex('membership_missed_share_comments', ['user_id'], {
      name: 'membership_missed_share_comments_user_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_missed_share_comments');
    await queryInterface.removeColumn('membership_missed_shares', 'seen_at');
  },
};
