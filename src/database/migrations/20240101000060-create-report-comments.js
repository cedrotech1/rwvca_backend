'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('report_comments', {
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
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
    await queryInterface.addIndex("report_comments", ["parent_id"], { name: "report_comments_parent_id" });
    await queryInterface.addIndex("report_comments", ["created_by"], { name: "report_comments_created_by" });
    await queryInterface.addIndex("report_comments", ["report_id","created_at"], { name: "report_comments_idx_report_created" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('report_comments');
  },
};
