'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_years', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      year_value: {
        type: Sequelize.SMALLINT,
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      is_active: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("membership_years", ["year_value"], { unique: true, name: "membership_years_uniq_year_value" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_years');
  },
};
