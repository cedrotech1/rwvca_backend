'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('assets', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      asset_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      serial_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      label_number: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      location: {
        type: Sequelize.ENUM("office", "user"),
        allowNull: false,
        defaultValue: "office",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: Sequelize.ENUM("available", "issued", "returned", "damaged"),
        allowNull: false,
        defaultValue: "available",
      },
      issued_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      returned_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      condition_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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
      },
      revert_status: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: "no",
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('assets');
  },
};
