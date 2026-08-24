'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('special_requisitions', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "Other",
      },
      type_other: {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      department_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      prepared_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      sended_to: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      executive_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      coordinator_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      coordinator_verification_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      executive_verification_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      verified_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      coordinator_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      coordinator_signature: {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: null,
      },
      approved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      executive_signature: {
        type: Sequelize.STRING(10),
        allowNull: true,
        defaultValue: null,
      },
      executive_approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      ed_signature_and_stamp: {
        type: Sequelize.STRING(30),
        allowNull: true,
        defaultValue: "no",
      },
      status: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "draft",
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      viewer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      viewer_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },
      viewer_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      viewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reverted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      reverted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      reversion_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      verification_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      approval_comment: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      rejected_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      rejected_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      authorized_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      authorized_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
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
    await queryInterface.addIndex("special_requisitions", ["prepared_by"], { name: "special_requisitions_idx_sr_prepared_by" });
    await queryInterface.addIndex("special_requisitions", ["sended_to"], { name: "special_requisitions_idx_sr_sended_to" });
    await queryInterface.addIndex("special_requisitions", ["status"], { name: "special_requisitions_idx_sr_status" });
    await queryInterface.addIndex("special_requisitions", ["type"], { name: "special_requisitions_idx_sr_type" });
    await queryInterface.addIndex("special_requisitions", ["department_id"], { name: "special_requisitions_idx_sr_department" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('special_requisitions');
  },
};
