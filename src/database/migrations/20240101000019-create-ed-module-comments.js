'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ed_module_comments', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      module_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      record_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("ed_module_comments", ["module_type","record_id"], { name: "ed_module_comments_idx_module_record" });
    await queryInterface.addIndex("ed_module_comments", ["parent_id"], { name: "ed_module_comments_idx_parent" });
    await queryInterface.addIndex("ed_module_comments", ["user_id"], { name: "ed_module_comments_idx_user" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ed_module_comments');
  },
};
