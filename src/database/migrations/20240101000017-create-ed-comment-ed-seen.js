'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ed_comment_ed_seen', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      ed_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      root_comment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      module_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      record_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      last_reply_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
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
    await queryInterface.addIndex("ed_comment_ed_seen", ["ed_user_id","root_comment_id"], { unique: true, name: "ed_comment_ed_seen_uq_ed_root" });
    await queryInterface.addIndex("ed_comment_ed_seen", ["ed_user_id","seen_at"], { name: "ed_comment_ed_seen_idx_ed_unseen" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ed_comment_ed_seen');
  },
};
