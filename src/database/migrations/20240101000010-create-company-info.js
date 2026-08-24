'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('company_info', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      company_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      website: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      facebook: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      twitter: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      instagram: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      linkedin: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      youtube: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      logo: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('company_info');
  },
};
