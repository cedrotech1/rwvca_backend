"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Users extends Model {
    static associate(models) {
      Users.hasMany(models.AssetLogs, { foreignKey: "performed_by_user_id", as: "asset_logs_performed_by_user_id" });
      Users.hasMany(models.AssetLogs, { foreignKey: "assigned_to_user_id", as: "asset_logs_assigned_to_user_id" });
      Users.hasMany(models.Assets, { foreignKey: "user_id", as: "assets_user_id" });
      Users.hasMany(models.Attendance, { foreignKey: "created_by", as: "attendance_created_by" });
      Users.hasMany(models.AttendanceUsers, { foreignKey: "user_id", as: "attendance_users_user_id" });
      Users.hasMany(models.CommunicationReplies, { foreignKey: "user_id", as: "communication_replies_user_id" });
      Users.hasMany(models.Communications, { foreignKey: "created_by", as: "communications_created_by" });
      Users.hasMany(models.DocumentComments, { foreignKey: "user_id", as: "document_comments_user_id" });
      Users.hasMany(models.DocumentShares, { foreignKey: "shared_by", as: "document_shares_shared_by" });
      Users.hasMany(models.DocumentShares, { foreignKey: "shared_to", as: "document_shares_shared_to" });
      Users.hasMany(models.Documents, { foreignKey: "created_by", as: "documents_created_by" });
      Users.hasMany(models.EdCommentEdSeen, { foreignKey: "ed_user_id", as: "ed_comment_ed_seen_ed_user_id" });
      Users.hasMany(models.EdCommentRecipients, { foreignKey: "user_id", as: "ed_comment_recipients_user_id" });
      Users.hasMany(models.EdModuleComments, { foreignKey: "user_id", as: "ed_module_comments_user_id" });
      Users.hasMany(models.InventoryItems, { foreignKey: "created_by", as: "inventory_items_created_by" });
      Users.hasMany(models.InventoryTransactions, { foreignKey: "user_id", as: "inventory_transactions_user_id" });
      Users.hasMany(models.LeaveRequests, { foreignKey: "user_id", as: "leave_requests_user_id" });
      Users.hasMany(models.LeaveSchedule, { foreignKey: "user_id", as: "leave_schedule_user_id" });
      Users.hasMany(models.LeaveScheduleReplies, { foreignKey: "sender_id", as: "leave_schedule_replies_sender_id" });
      Users.hasMany(models.LeaveScheduleReplies, { foreignKey: "receiver_id", as: "leave_schedule_replies_receiver_id" });
      Users.hasMany(models.Logs, { foreignKey: "user_id", as: "logs_user_id" });
      Users.hasMany(models.MembershipReportComments, { foreignKey: "user_id", as: "membership_report_comments_user_id" });
      Users.hasMany(models.MembershipReportLogs, { foreignKey: "user_id", as: "membership_report_logs_user_id" });
      Users.hasMany(models.MembershipReportReviewers, { foreignKey: "reviewer_id", as: "membership_report_reviewers" });
      Users.hasMany(models.MembershipReportReviewers, { foreignKey: "assigned_by", as: "membership_report_reviewer_assignments" });
      Users.hasMany(models.MembershipReports, { foreignKey: "user_id", as: "membership_reports_user_id" });
      Users.hasMany(models.MembershipReports, { foreignKey: "submitted_by", as: "membership_reports_submitted_by" });
      Users.hasMany(models.MembershipReports, { foreignKey: "approved_by", as: "membership_reports_approved_by" });
      Users.hasMany(models.MissionRequests, { foreignKey: "user_id", as: "mission_requests_user_id" });
      Users.hasMany(models.Notifications, { foreignKey: "receiver_id", as: "notifications_receiver_id" });
      Users.hasMany(models.ReportComments, { foreignKey: "created_by", as: "report_comments_created_by" });
      Users.hasMany(models.Reports, { foreignKey: "created_by", as: "reports_created_by" });
      Users.hasMany(models.Requisitions, { foreignKey: "prepared_by", as: "requisitions_prepared_by" });
      Users.hasMany(models.Requisitions, { foreignKey: "sended_to", as: "requisitions_sended_to" });
      Users.hasMany(models.Requisitions, { foreignKey: "verified_by", as: "requisitions_verified_by" });
      Users.hasMany(models.Requisitions, { foreignKey: "approved_by", as: "requisitions_approved_by" });
      Users.hasMany(models.Requisitions, { foreignKey: "viewer_id", as: "requisitions_viewer_id" });
      Users.hasMany(models.Requisitions, { foreignKey: "reverted_by", as: "requisitions_reverted_by" });
      Users.hasMany(models.Requisitions, { foreignKey: "submitted_by", as: "requisitions_submitted_by" });
      Users.hasMany(models.Requisitions, { foreignKey: "rejected_by", as: "requisitions_rejected_by" });
      Users.hasMany(models.Requisitions, { foreignKey: "authorized_by", as: "requisitions_authorized_by" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "prepared_by", as: "special_requisitions_prepared_by" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "sended_to", as: "special_requisitions_sended_to" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "verified_by", as: "special_requisitions_verified_by" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "approved_by", as: "special_requisitions_approved_by" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "viewer_id", as: "special_requisitions_viewer_id" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "reverted_by", as: "special_requisitions_reverted_by" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "rejected_by", as: "special_requisitions_rejected_by" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "authorized_by", as: "special_requisitions_authorized_by" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "coordinator_id", as: "special_requisitions_coordinator_id" });
      Users.hasMany(models.SpecialRequisitions, { foreignKey: "executive_id", as: "special_requisitions_executive_id" });
      Users.hasMany(models.Tickets, { foreignKey: "assigned_to", as: "tickets_assigned_to" });
      Users.hasMany(models.TicketLogs, { foreignKey: "user_id", as: "ticket_logs_user_id" });
      Users.hasMany(models.TicketReplies, { foreignKey: "user_id", as: "ticket_replies_user_id" });
      Users.hasMany(models.Tickets, { foreignKey: "created_by", as: "tickets_created_by" });
      Users.hasMany(models.TodoActivityLog, { foreignKey: "user_id", as: "todo_activity_log_user_id" });
      Users.hasMany(models.TodoComments, { foreignKey: "user_id", as: "todo_comments_user_id" });
      Users.hasMany(models.TodoShares, { foreignKey: "shared_by", as: "todo_shares_shared_by" });
      Users.hasMany(models.UserAllowedDays, { foreignKey: "user_id", as: "user_allowed_days_user_id" });
      Users.hasMany(models.UserTasks, { foreignKey: "user_id", as: "user_tasks_user_id" });
      Users.hasMany(models.UserTasks, { foreignKey: "shared_by", as: "user_tasks_shared_by" });
      Users.belongsTo(models.Department, { foreignKey: "department_ID", as: "department" });
    }
  }

  Users.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      names: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      personal_email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      other_phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null,
      },
      gender: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      image: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: null,
      },
      bio: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      role: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      department_ID: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      working_area: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      living_district: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
      },
      dob: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      nationality: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      employee_id_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      password: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      active: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      resetcode: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      deleted: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "0",
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      signature_url: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      signature_approved: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "0",
      },
      allowed_leave_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      force_deactivated: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "Users",
      tableName: "users",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      paranoid: true,
      deletedAt: "deleted_at",
    }
  );

  return Users;
};
