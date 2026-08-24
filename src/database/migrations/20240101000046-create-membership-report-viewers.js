'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('membership_report_viewers', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      report_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      viewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("membership_report_viewers", ["report_id","user_id"], { unique: true, name: "membership_report_viewers_unique_report_viewer" });
    await queryInterface.addIndex("membership_report_viewers", ["user_id"], { name: "membership_report_viewers_user_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('membership_report_viewers');
  },
};
