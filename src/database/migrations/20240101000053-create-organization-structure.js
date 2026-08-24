'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('organization_structure', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      unit_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      unit_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      level: {
        type: Sequelize.ENUM("top", "middle", "bottom"),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
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
    await queryInterface.addIndex("organization_structure", ["unit_key"], { unique: true, name: "organization_structure_unit_key" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('organization_structure');
  },
};
