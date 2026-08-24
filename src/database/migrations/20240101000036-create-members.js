'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('members', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      company_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      owner_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      shareholder: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      gender: {
        type: Sequelize.ENUM("Male", "Female"),
        allowNull: true,
        defaultValue: null,
      },
      rdb_certificate: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      tin: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      national_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      province: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      district: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      role: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      has_rwvca_role: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      rwvca_role: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      membership_category_platform_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      membership_status: {
        type: Sequelize.ENUM("Paid", "Not Paid", "Partial"),
        allowNull: true,
        defaultValue: null,
      },
      registration_status: {
        type: Sequelize.ENUM("Paid", "Not Paid"),
        allowNull: true,
        defaultValue: "Not Paid",
      },
      registration_paid_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      employees_women: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      employees_men: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      employees_pwd: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      date_joined: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      is_active: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      membership_category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      }
    });
    await queryInterface.addIndex("members", ["membership_category_platform_id"], { name: "membership_category_platform_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('members');
  },
};
