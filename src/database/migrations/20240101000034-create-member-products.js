'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('member_products', {
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      product_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      company_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      website_url: {
        type: Sequelize.STRING(300),
        allowNull: true,
        defaultValue: null,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      image1_url: {
        type: Sequelize.STRING(300),
        allowNull: true,
        defaultValue: null,
      },
      image2_url: {
        type: Sequelize.STRING(300),
        allowNull: true,
        defaultValue: null,
      },
      image3_url: {
        type: Sequelize.STRING(300),
        allowNull: true,
        defaultValue: null,
      },
      is_active: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('member_products');
  },
};
