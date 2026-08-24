'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attendance_users', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      attendance_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      signed: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      responded_at: {
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
    await queryInterface.addIndex("attendance_users", ["attendance_id","user_id"], { unique: true, name: "attendance_users_unique_pair" });
    await queryInterface.addIndex("attendance_users", ["user_id"], { name: "attendance_users_user_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('attendance_users');
  },
};
