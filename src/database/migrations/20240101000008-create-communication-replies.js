'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('communication_replies', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      communication_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reply_text: {
        type: Sequelize.TEXT,
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
      },
      parent_reply_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: Sequelize.ENUM("active", "deleted"),
        allowNull: true,
        defaultValue: "active",
      }
    });
    await queryInterface.addIndex("communication_replies", ["communication_id"], { name: "communication_replies_idx_communication" });
    await queryInterface.addIndex("communication_replies", ["user_id"], { name: "communication_replies_idx_user" });
    await queryInterface.addIndex("communication_replies", ["created_at"], { name: "communication_replies_idx_created" });
    await queryInterface.addIndex("communication_replies", ["parent_reply_id"], { name: "communication_replies_idx_parent" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('communication_replies');
  },
};
