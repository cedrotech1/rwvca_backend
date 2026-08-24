'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('communications', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      communication_type: {
        type: Sequelize.ENUM("general", "permission"),
        allowNull: false,
        defaultValue: "general",
      },
      users: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      viewed_users: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      attachment_url: {
        type: Sequelize.STRING(200),
        allowNull: true,
        defaultValue: null,
      },
      link: {
        type: Sequelize.STRING(200),
        allowNull: true,
        defaultValue: null,
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('communications');
  },
};
