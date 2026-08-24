'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ticket_replies', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      ticket_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      attachments: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      is_status_update: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      new_status: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      }
    });
    await queryInterface.addIndex("ticket_replies", ["ticket_id"], { name: "ticket_replies_ticket_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ticket_replies');
  },
};
