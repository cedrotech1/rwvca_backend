'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('team', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      names: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      image: {
        type: Sequelize.STRING(200),
        allowNull: true,
        defaultValue: null,
      },
      bio: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      role: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      active: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      resetcode: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      deleted: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "no",
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('team');
  },
};
