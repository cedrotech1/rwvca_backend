'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
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
      personal_email: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      other_phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },
      gender: {
        type: Sequelize.STRING(10),
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
      department_ID: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      working_area: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      living_district: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      dob: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      nationality: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      employee_id_number: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
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
        defaultValue: "0",
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      signature_url: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      signature_approved: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: "0",
      },
      allowed_leave_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
