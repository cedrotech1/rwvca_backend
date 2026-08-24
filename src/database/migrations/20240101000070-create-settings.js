'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('settings', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      leave_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 21,
      },
      send_email_notification: {
        type: Sequelize.STRING(5),
        allowNull: true,
        defaultValue: "yes",
      },
      system_status: {
        type: Sequelize.ENUM("live", "maintenance", "offline"),
        allowNull: false,
        defaultValue: "live",
      },
      export_db_password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      stamp_with_signature: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: "",
      },
      signature_only: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: "",
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('settings');
  },
};
