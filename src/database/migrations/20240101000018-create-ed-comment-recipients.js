'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ed_comment_recipients', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      comment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
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
      replied_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("ed_comment_recipients", ["comment_id","user_id"], { unique: true, name: "ed_comment_recipients_uq_comment_user" });
    await queryInterface.addIndex("ed_comment_recipients", ["user_id","replied_at"], { name: "ed_comment_recipients_idx_user_unreplied" });
    await queryInterface.addIndex("ed_comment_recipients", ["module_type","record_id"], { name: "ed_comment_recipients_idx_module_record" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ed_comment_recipients');
  },
};
