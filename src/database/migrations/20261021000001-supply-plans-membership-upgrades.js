"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.createTable("supply_requisitions", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      supply_type: { type: Sequelize.STRING(30), allowNull: false },
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "draft" },
      prepared_by: { type: Sequelize.INTEGER, allowNull: false },
      requester_department_id: { type: Sequelize.INTEGER, allowNull: true },
      assigned_department_id: { type: Sequelize.INTEGER, allowNull: true },
      assigned_to: { type: Sequelize.INTEGER, allowNull: true },
      approved_by: { type: Sequelize.INTEGER, allowNull: true },
      authorized_by: { type: Sequelize.INTEGER, allowNull: true },
      rejected_by: { type: Sequelize.INTEGER, allowNull: true },
      reverted_by: { type: Sequelize.INTEGER, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      reject_reason: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("supply_requisition_items", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      supply_requisition_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "supply_requisitions", key: "id" },
        onDelete: "CASCADE",
      },
      item_no: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      item_name: { type: Sequelize.STRING(255), allowNull: false },
      quantity: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
      description: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("supply_requisition_logs", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      supply_requisition_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "supply_requisitions", key: "id" },
        onDelete: "CASCADE",
      },
      action: { type: Sequelize.STRING(80), allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: true },
      changed_by: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("employee_plans", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      title: { type: Sequelize.STRING(300), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "draft" },
      is_joint: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("employee_plan_collaborators", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "employee_plans", key: "id" },
        onDelete: "CASCADE",
      },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      response_status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "pending" },
      reply_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("employee_plan_comments", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "employee_plans", key: "id" },
        onDelete: "CASCADE",
      },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("employee_plan_reports", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      report_type: { type: Sequelize.STRING(20), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      period_start: { type: Sequelize.DATEONLY, allowNull: false },
      period_end: { type: Sequelize.DATEONLY, allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: true },
      shared_department_ids: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addColumn("member_year_payments", "amount_paid", {
      type: Sequelize.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("member_year_payments", "amount_due", {
      type: Sequelize.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("membership_report_items", "has_vat", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("assets", "condition_status", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "good",
    });
    await queryInterface.addColumn("assets", "department_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("assets", "in_use", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("users", "last_login_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Seed new privileges if table exists
    try {
      const privs = [
        ["menu.supply_requisitions", "Supply Requisitions", "menu", "Kitchen & hygienic requests", 88],
        ["menu.create.supply_requisition", "Create Supply Requisition", "menu", null, 48],
        ["menu.view.supply_requisitions", "View Supply Requisitions", "menu", null, 59],
        ["menu.employee_plans", "Employee Plans", "menu", null, 67],
        ["menu.staff_monitoring", "Staff Monitoring", "menu", null, 26],
        ["menu.logistic_dashboard", "Logistic Dashboard", "menu", null, 69],
        ["menu.members_dashboard", "Members Dashboard", "menu", null, 76],
        ["supply.manage", "Manage supply requisitions", "capability", "Logistic approve/assign supply requests", 121],
        ["supply.authorize", "Authorize supply requisitions", "capability", "ED authorize supply requests", 122],
        ["plans.manage", "Manage employee plans", "capability", null, 193],
        ["plans.monitor", "Monitor staff plans", "capability", null, 194],
        ["logistic.dashboard", "Logistic inventory dashboard", "capability", null, 152],
        ["members.dashboard", "Advanced members dashboard", "capability", null, 141],
      ];
      for (const [code, name, category, description, sort_order] of privs) {
        await queryInterface.sequelize.query(
          `INSERT INTO privileges (code, name, description, category, sort_order, created_at, updated_at)
           SELECT :code, :name, :description, :category, :sort_order, :now, :now
           WHERE NOT EXISTS (SELECT 1 FROM privileges WHERE code = :code)`,
          { replacements: { code, name, description, category, sort_order, now } }
        );
      }

      const grant = async (roleName, codes) => {
        const [roles] = await queryInterface.sequelize.query(
          `SELECT id FROM roles WHERE LOWER(role_name) = LOWER(:name) LIMIT 1`,
          { replacements: { name: roleName } }
        );
        if (!roles[0]) return;
        const roleId = roles[0].id;
        for (const code of codes) {
          const [p] = await queryInterface.sequelize.query(
            `SELECT id FROM privileges WHERE code = :code LIMIT 1`,
            { replacements: { code } }
          );
          if (!p[0]) continue;
          await queryInterface.sequelize.query(
            `INSERT INTO role_privileges (role_id, privilege_id, created_at, updated_at)
             SELECT :roleId, :pid, :now, :now
             WHERE NOT EXISTS (
               SELECT 1 FROM role_privileges WHERE role_id = :roleId AND privilege_id = :pid
             )`,
            { replacements: { roleId, pid: p[0].id, now } }
          );
        }
      };

      const staffBase = [
        "menu.supply_requisitions",
        "menu.create.supply_requisition",
        "menu.view.supply_requisitions",
        "menu.employee_plans",
        "plans.manage",
      ];
      for (const role of ["admin", "ED", "Chairman", "HR", "Accountant", "logistic", "Membership Coordinator", "default", "employee", "member"]) {
        await grant(role, staffBase);
      }
      await grant("logistic", ["supply.manage", "menu.logistic_dashboard", "logistic.dashboard"]);
      await grant("Membership Coordinator", ["supply.manage", "menu.logistic_dashboard", "logistic.dashboard"]);
      await grant("admin", ["supply.manage", "supply.authorize", "menu.staff_monitoring", "plans.monitor", "menu.logistic_dashboard", "logistic.dashboard", "menu.members_dashboard", "members.dashboard"]);
      await grant("ED", ["supply.authorize", "menu.staff_monitoring", "plans.monitor", "menu.members_dashboard", "members.dashboard"]);
      await grant("Chairman", ["supply.authorize", "menu.staff_monitoring", "plans.monitor", "menu.members_dashboard", "members.dashboard"]);
      await grant("HR", ["menu.staff_monitoring", "plans.monitor"]);
      await grant("Accountant", ["menu.members_dashboard", "members.dashboard"]);
    } catch (e) {
      console.warn("Privilege seed skipped:", e.message);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "last_login_at").catch(() => {});
    await queryInterface.removeColumn("assets", "in_use").catch(() => {});
    await queryInterface.removeColumn("assets", "department_id").catch(() => {});
    await queryInterface.removeColumn("assets", "condition_status").catch(() => {});
    await queryInterface.removeColumn("membership_report_items", "has_vat").catch(() => {});
    await queryInterface.removeColumn("member_year_payments", "amount_due").catch(() => {});
    await queryInterface.removeColumn("member_year_payments", "amount_paid").catch(() => {});
    await queryInterface.dropTable("employee_plan_reports");
    await queryInterface.dropTable("employee_plan_comments");
    await queryInterface.dropTable("employee_plan_collaborators");
    await queryInterface.dropTable("employee_plans");
    await queryInterface.dropTable("supply_requisition_logs");
    await queryInterface.dropTable("supply_requisition_items");
    await queryInterface.dropTable("supply_requisitions");
  },
};
