'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('document_comments', {
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
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      parent_comment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      comment_text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      commented_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('document_comments');
  },
};
