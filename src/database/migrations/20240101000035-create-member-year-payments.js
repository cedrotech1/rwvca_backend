'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('member_year_payments', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      member_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      year_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      payment_status: {
        type: Sequelize.ENUM("Paid", "Not Paid", "Partial"),
        allowNull: false,
        defaultValue: "Not Paid",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.addIndex("member_year_payments", ["member_id","year_id"], { unique: true, name: "member_year_payments_uniq_member_year" });
    await queryInterface.addIndex("member_year_payments", ["year_id","payment_status"], { name: "member_year_payments_idx_year_status" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('member_year_payments');
  },
};
