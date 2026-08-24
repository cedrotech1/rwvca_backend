import { Op } from "sequelize";
import db from "../database/models/index.js";

const LIMIT = 150;

const VALID_MODULES = [
  "requisitions",
  "special_requisitions",
  "leave_requests",
  "leave_schedule",
  "missions",
  "documents",
  "reports",
  "membership_reports",
  "tickets",
  "todos",
  "communications",
  "assets",
  "attendance",
  "permissions",
  "users",
  "inventory",
  "members",
];

export const ED_VALID_TABS = [
  "overview",
  ...VALID_MODULES,
];

async function countModel(model, where = {}) {
  try {
    return await model.count({ where });
  } catch {
    return 0;
  }
}

export async function fetchEdSummary() {
  const summary = {
    requisitions: await countModel(db.Requisitions),
    special_requisitions: await countModel(db.SpecialRequisitions),
    leave_requests: await countModel(db.LeaveRequests),
    leave_schedule: await countModel(db.LeaveSchedule),
    missions: await countModel(db.MissionRequests),
    documents: await countModel(db.Documents),
    reports: await countModel(db.Reports),
    membership_reports: await countModel(db.MembershipReports),
    tickets: await countModel(db.Tickets),
    assets: await countModel(db.Assets),
    attendance: await countModel(db.Attendance),
    inventory: await countModel(db.InventoryItems),
    todos: await countModel(db.UserTasks),
    communications: await countModel(db.Communications, { communication_type: "general" }),
    permissions: await countModel(db.Communications, { communication_type: "permission" }),
    users: await countModel(db.Users, { deleted: { [Op.or]: [null, "0", 0, false] } }),
    members: await countModel(db.Members),
  };
  return summary;
}

export async function fetchCommentCounts(module) {
  const rows = await db.EdModuleComments.findAll({
    attributes: [
      "record_id",
      [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
    ],
    where: { module_type: module, parent_id: null },
    group: ["record_id"],
    raw: true,
  });
  const map = {};
  rows.forEach((row) => {
    map[row.record_id] = Number(row.count || 0);
  });
  return map;
}

function mapPreparer(row, prefix = "") {
  const plain = row?.get ? row.get({ plain: true }) : row;
  return {
    ...plain,
    department_name: plain.department?.name || plain.department_name || null,
    prepared_by_name: plain.preparer?.names || plain.prepared_by_name || null,
    authorized_by_name: plain.authorizer?.names || plain.authorized_by_name || null,
    creator_name: plain.creator?.names || plain.creator_name || null,
    applicant_name: plain.user?.names || plain.applicant_name || null,
    applicant_role: plain.user?.role || plain.applicant_role || null,
    employee_name: plain.user?.names || plain.employee_name || null,
    created_by_name: plain.creator?.names || plain.created_by_name || null,
    assigned_to_name: plain.assignee?.names || plain.assigned_to_name || null,
    owner_name: plain.user?.names || plain.owner_name || null,
    assigned_to_name_alt: plain.assignee?.names,
  };
}

export async function fetchModuleRecords(module) {
  if (!VALID_MODULES.includes(module)) return [];

  switch (module) {
    case "requisitions":
      return (await db.Requisitions.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [
          { model: db.Department, as: "department", attributes: ["name"] },
          { model: db.Users, as: "preparer", attributes: ["names"] },
          { model: db.Users, as: "authorizer", attributes: ["names"] },
        ],
      })).map(mapPreparer);

    case "special_requisitions":
      return (await db.SpecialRequisitions.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [
          { model: db.Department, as: "department", attributes: ["name"] },
          { model: db.Users, as: "preparer", attributes: ["names"] },
          { model: db.Users, as: "authorizer", attributes: ["names"] },
        ],
      })).map(mapPreparer);

    case "leave_requests":
      return (await db.LeaveRequests.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "user", attributes: ["names", "role"] }],
      })).map((row) => {
        const plain = mapPreparer(row);
        return {
          ...plain,
          applicant_name: plain.user?.names,
          applicant_role: plain.user?.role,
        };
      });

    case "leave_schedule":
      return (await db.LeaveSchedule.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [
          { model: db.Users, as: "user", attributes: ["names", "department_ID"] },
        ],
      })).map((row) => {
        const plain = mapPreparer(row);
        return {
          ...plain,
          employee_name: plain.user?.names || plain.employee_name,
        };
      });

    case "missions":
      return (await db.MissionRequests.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "user", attributes: ["names"] }],
      })).map((row) => {
        const plain = mapPreparer(row);
        return { ...plain, applicant_name: plain.user?.names };
      });

    case "documents":
      const docs = await db.Documents.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "creator", attributes: ["names"] }],
      });
      const shareCounts = await db.DocumentShares.findAll({
        attributes: [
          "document_id",
          [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
        ],
        group: ["document_id"],
        raw: true,
      });
      const shareMap = Object.fromEntries(shareCounts.map((r) => [r.document_id, Number(r.count)]));
      return docs.map((row) => {
        const plain = mapPreparer(row);
        return { ...plain, share_count: shareMap[plain.id] || 0, creator_name: plain.creator?.names };
      });

    case "reports":
      const reports = await db.Reports.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "creator", attributes: ["names"] }],
      });
      const commentCounts = await db.ReportComments.findAll({
        attributes: [
          "report_id",
          [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
        ],
        group: ["report_id"],
        raw: true,
      });
      const commentMap = Object.fromEntries(commentCounts.map((r) => [r.report_id, Number(r.count)]));
      return reports.map((row) => {
        const plain = mapPreparer(row);
        return { ...plain, comment_count: commentMap[plain.id] || 0, creator_name: plain.creator?.names };
      });

    case "membership_reports":
      return (await db.MembershipReports.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "user", attributes: ["names"] }],
      })).map((row) => {
        const plain = mapPreparer(row);
        return { ...plain, creator_name: plain.user?.names };
      });

    case "tickets":
      return (await db.Tickets.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [
          { model: db.Users, as: "creator", attributes: ["names"] },
          { model: db.Users, as: "assignee", attributes: ["names"] },
        ],
      })).map((row) => {
        const plain = mapPreparer(row);
        return {
          ...plain,
          created_by_name: plain.creator?.names,
          assigned_to_name: plain.assignee?.names,
        };
      });

    case "todos":
      return (await db.UserTasks.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "user", attributes: ["names"] }],
      })).map((row) => {
        const plain = mapPreparer(row);
        return { ...plain, owner_name: plain.user?.names };
      });

    case "communications":
      return (await db.Communications.findAll({
        where: { communication_type: "general" },
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "creator", attributes: ["names"] }],
      })).map(mapPreparer);

    case "permissions":
      return (await db.Communications.findAll({
        where: { communication_type: "permission" },
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "creator", attributes: ["names"] }],
      })).map(mapPreparer);

    case "assets":
      return (await db.Assets.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "user", attributes: ["names"] }],
      })).map((row) => {
        const plain = mapPreparer(row);
        return { ...plain, assigned_to_name: plain.user?.names };
      });

    case "attendance":
      const attendanceRows = await db.Attendance.findAll({
        limit: LIMIT,
        order: [["created_at", "DESC"]],
        include: [{ model: db.Users, as: "creator", attributes: ["names"] }],
      });
      const attUsers = await db.AttendanceUsers.findAll({
        attributes: [
          "attendance_id",
          "signed",
          [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
        ],
        group: ["attendance_id", "signed"],
        raw: true,
      });
      const invitedMap = {};
      const signedMap = {};
      attUsers.forEach((r) => {
        invitedMap[r.attendance_id] = (invitedMap[r.attendance_id] || 0) + Number(r.count);
        if (Number(r.signed) === 1) signedMap[r.attendance_id] = Number(r.count);
      });
      return attendanceRows.map((row) => {
        const plain = mapPreparer(row);
        return {
          ...plain,
          creator_name: plain.creator?.names,
          total_invited: invitedMap[plain.id] || 0,
          signed_count: signedMap[plain.id] || 0,
        };
      });

    case "users":
      return (await db.Users.findAll({
        where: { deleted: { [Op.or]: [null, "0", 0, false] } },
        limit: 200,
        order: [["names", "ASC"]],
        include: [{ model: db.Department, as: "department", attributes: ["name"] }],
      })).map((row) => {
        const plain = mapPreparer(row);
        return { ...plain, department_name: plain.department?.name };
      });

    case "inventory":
      return (await db.InventoryItems.findAll({
        limit: LIMIT,
        order: [["name", "ASC"]],
        include: [{ model: db.Users, as: "creator", attributes: ["names"] }],
      })).map((row) => {
        const plain = mapPreparer(row);
        return { ...plain, created_by_name: plain.creator?.names };
      });

    case "members":
      return (await db.Members.findAll({
        limit: LIMIT,
        order: [["date_joined", "DESC"], ["id", "DESC"]],
        include: [
          { model: db.MembershipCategoriesPlatform, as: "platformCategory", attributes: ["name"] },
        ],
      })).map((row) => {
        const plain = row.get({ plain: true });
        return {
          ...plain,
          category_name: plain.platformCategory?.name,
        };
      });

    default:
      return [];
  }
}
