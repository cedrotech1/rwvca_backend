'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('programs', {
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
      application_deadline: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      requirements: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      why_apply: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      application_link: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      category: {
        type: Sequelize.ENUM("upcoming", "recent", "main"),
        allowNull: false,
        defaultValue: "upcoming",
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
    await queryInterface.addIndex("programs", ["status"], { name: "programs_status" });
    await queryInterface.addIndex("programs", ["category"], { name: "programs_category" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('programs');
  },
};
