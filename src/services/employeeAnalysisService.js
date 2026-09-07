import { Op } from "sequelize";
import db from "../database/models/index.js";
import { buildLeaveAnalytics } from "./leaveAnalyticsService.js";
import { getLeaveBalance } from "./leaveBalanceService.js";

const sequelize = db.sequelize;

function periodRange(query = {}) {
  const now = new Date();
  const period = String(query.period || "year").toLowerCase();
  const year = Number(query.year) || now.getFullYear();

  if (query.date_from && query.date_to) {
    return {
      period: "custom",
      from: new Date(`${query.date_from}T00:00:00`),
      to: new Date(`${query.date_to}T23:59:59`),
      year,
    };
  }
  if (period === "month") {
    const m = now.getMonth();
    return {
      period,
      from: new Date(year, m, 1),
      to: new Date(year, m + 1, 0, 23, 59, 59),
      year,
    };
  }
  return {
    period: "year",
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31, 23, 59, 59),
    year,
  };
}

function dateWhere(from, to, field = "created_at") {
  return { [field]: { [Op.between]: [from, to] } };
}

async function countSafe(model, where = {}) {
  try {
    return await model.count({ where });
  } catch {
    return 0;
  }
}

async function statusBreakdown(model, where, field) {
  const total = await countSafe(model, where);
  const statuses = {};
  try {
    const rows = await model.findAll({
      attributes: [
        [sequelize.col(field), "status_value"],
        [sequelize.fn("COUNT", sequelize.literal("1")), "count"],
      ],
      where,
      group: [field],
      raw: true,
    });
    for (const row of rows) {
      const key = String(row.status_value || "unknown").trim().toLowerCase() || "unknown";
      statuses[key] = Number(row.count || 0);
    }
  } catch {
    /* keep empty statuses map */
  }

  const sumMatching = (predicate) =>
    Object.entries(statuses).reduce((sum, [key, count]) => (predicate(key) ? sum + count : sum), 0);

  const pending = sumMatching((key) => key.includes("pending"));
  const approved = sumMatching((key) => key.includes("approved") || key === "paid" || key === "authorized");
  const rejected = sumMatching((key) => key.includes("reject") || key.includes("revert"));

  return { total, pending, approved, rejected, statuses };
}

async function recentRows(model, where, attributes, extra = {}) {
  try {
    return await model.findAll({
      where,
      attributes,
      order: [["created_at", "DESC"]],
      limit: 20,
      ...extra,
    });
  } catch {
    return [];
  }
}

async function monthlyTrend(model, where, from, to) {
  try {
    const rows = await model.findAll({
      attributes: [
        [sequelize.fn("date_trunc", "month", sequelize.col("created_at")), "month"],
        [sequelize.fn("count", sequelize.col("id")), "count"],
      ],
      where: { ...where, created_at: { [Op.between]: [from, to] } },
      group: [sequelize.fn("date_trunc", "month", sequelize.col("created_at"))],
      order: [[sequelize.fn("date_trunc", "month", sequelize.col("created_at")), "ASC"]],
      raw: true,
    });
    return rows.map((row) => ({ month: row.month, count: Number(row.count || 0) }));
  } catch {
    return [];
  }
}

function moduleBlock(key, label, path, stats = {}, recent = []) {
  return { key, label, path, openTo: path, ...stats, recent: recent.map((row) => (row.toJSON ? row.toJSON() : row)) };
}

async function todoBreakdown(where) {
  const total = await countSafe(db.UserTasks, where);
  const approved = await countSafe(db.UserTasks, { ...where, is_completed: 1 });
  const pending = total - approved;
  return { total, pending, approved, rejected: 0 };
}

async function countOnlyBreakdown(model, where) {
  const total = await countSafe(model, where);
  return { total, pending: 0, approved: 0, rejected: 0 };
}

async function countUserActivity(userId, ranged) {
  const [
    missions,
    leave,
    schedules,
    requisitions,
    vehicles,
    assets,
    documents,
    reports,
    membershipReports,
    communications,
    permissions,
    ticketsCreated,
    ticketsAssigned,
    todos,
    attendance,
    logs,
  ] = await Promise.all([
    countSafe(db.MissionRequests, { ...ranged, user_id: userId }),
    countSafe(db.LeaveRequests, { ...ranged, user_id: userId }),
    countSafe(db.LeaveSchedule, { ...ranged, user_id: userId }),
    countSafe(db.Requisitions, { ...ranged, prepared_by: userId }),
    countSafe(db.SpecialRequisitions, { ...ranged, prepared_by: userId }),
    countSafe(db.Assets, { user_id: userId }),
    countSafe(db.Documents, { ...ranged, created_by: userId }),
    countSafe(db.Reports, { ...ranged, created_by: userId }),
    countSafe(db.MembershipReports, { ...ranged, [Op.or]: [{ user_id: userId }, { submitted_by: userId }] }),
    countSafe(db.Communications, { ...ranged, communication_type: "general", created_by: userId }),
    countSafe(db.Communications, { ...ranged, communication_type: "permission", created_by: userId }),
    countSafe(db.Tickets, { ...ranged, created_by: userId }),
    countSafe(db.Tickets, { ...ranged, assigned_to: userId }),
    countSafe(db.UserTasks, { ...ranged, user_id: userId }),
    countSafe(db.AttendanceUsers, { user_id: userId }),
    countSafe(db.Logs, { ...ranged, user_id: userId }),
  ]);

  const total =
    missions + leave + schedules + requisitions + vehicles + assets + documents + reports +
    membershipReports + communications + permissions + ticketsCreated + ticketsAssigned + todos + attendance + logs;

  return {
    total,
    missions,
    leave,
    schedules,
    requisitions,
    vehicles,
    assets,
    documents,
    reports,
    membershipReports,
    communications,
    permissions,
    tickets: ticketsCreated + ticketsAssigned,
    todos,
    attendance,
    logs,
  };
}

export async function buildEmployeesOverview(query = {}) {
  const range = periodRange(query);
  const ranged = dateWhere(range.from, range.to);
  const search = String(query.search || "").trim();
  const departmentId = query.department_id ? Number(query.department_id) : null;
  const roleFilter = query.role ? String(query.role) : null;

  const where = {
    deleted: { [Op.ne]: "1" },
    active: query.active !== undefined && query.active !== "" ? Number(query.active) : 1,
  };
  if (departmentId) where.department_ID = departmentId;
  if (roleFilter) where.role = roleFilter;
  if (search) {
    where[Op.or] = [
      { names: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
      { role: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const users = await db.Users.findAll({
    where,
    attributes: ["id", "names", "email", "role", "gender", "phone", "active", "department_ID", "created_at", "signature_approved", "signature_url"],
    include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
    order: [["names", "ASC"]],
    limit: Math.min(Number(query.limit) || 300, 500),
  });

  const genderMap = {};
  const departmentMap = {};
  const roleMap = {};
  let activeCount = 0;
  let inactiveCount = 0;

  users.forEach((user) => {
    const gender = user.gender || "Unknown";
    genderMap[gender] = (genderMap[gender] || 0) + 1;
    const dept = user.department?.name || "Unassigned";
    departmentMap[dept] = (departmentMap[dept] || 0) + 1;
    const role = user.role || "Unknown";
    roleMap[role] = (roleMap[role] || 0) + 1;
    if (Number(user.active) === 1) activeCount += 1;
    else inactiveCount += 1;
  });

  const activityEntries = await Promise.all(
    users.map(async (user) => {
      const activity = await countUserActivity(user.id, ranged);
      return {
        user_id: user.id,
        names: user.names,
        email: user.email,
        role: user.role,
        gender: user.gender,
        department: user.department?.name || null,
        department_id: user.department_ID,
        active: user.active,
        activity_total: activity.total,
        activity,
      };
    })
  );

  const topActive = [...activityEntries]
    .sort((a, b) => b.activity_total - a.activity_total)
    .slice(0, 12);

  return {
    period: {
      ...range,
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
    },
    summary: {
      employees: users.length,
      active: activeCount,
      inactive: inactiveCount,
      departments: Object.keys(departmentMap).length,
      roles: Object.keys(roleMap).length,
    },
    gender: Object.entries(genderMap).map(([label, value]) => ({ label, value })),
    by_department: Object.entries(departmentMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    by_role: Object.entries(roleMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    top_active: topActive,
    employees: activityEntries,
  };
}

export async function buildEmployeeAnalysis(userId, query = {}) {
  const range = periodRange(query);
  const ranged = dateWhere(range.from, range.to);
  const year = range.year;

  const user = await db.Users.findByPk(userId, {
    attributes: { exclude: ["password", "resetcode"] },
    include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
  });
  if (!user) return null;

  const [
    leaveBalance,
    leaveAnalytics,
    missionsStats,
    leaveStats,
    scheduleStats,
    reqStats,
    vehicleStats,
    assetStats,
    docStats,
    reportStats,
    mrStats,
    commStats,
    permStats,
    ticketCreatedStats,
    ticketAssignedStats,
    todoStats,
    attendanceCount,
    logCount,
    commReceivedCount,
    leaveDays,
  ] = await Promise.all([
    getLeaveBalance(userId),
    buildLeaveAnalytics({ user_id: userId, year, limit: 1 }),
    statusBreakdown(db.MissionRequests, { ...ranged, user_id: userId }, "mission_requests_status"),
    statusBreakdown(db.LeaveRequests, { ...ranged, user_id: userId }, "leave_requests_status"),
    statusBreakdown(db.LeaveSchedule, { ...ranged, user_id: userId }, "status"),
    statusBreakdown(db.Requisitions, { ...ranged, prepared_by: userId }, "status"),
    statusBreakdown(db.SpecialRequisitions, { ...ranged, prepared_by: userId }, "status"),
    statusBreakdown(db.Assets, { user_id: userId }, "status"),
    statusBreakdown(db.Documents, { ...ranged, created_by: userId }, "status"),
    statusBreakdown(db.Reports, { ...ranged, created_by: userId }, "status"),
    statusBreakdown(db.MembershipReports, { ...ranged, [Op.or]: [{ user_id: userId }, { submitted_by: userId }] }, "status"),
    countOnlyBreakdown(db.Communications, { ...ranged, communication_type: "general", created_by: userId }),
    countOnlyBreakdown(db.Communications, { ...ranged, communication_type: "permission", created_by: userId }),
    statusBreakdown(db.Tickets, { ...ranged, created_by: userId }, "status"),
    statusBreakdown(db.Tickets, { ...ranged, assigned_to: userId }, "status"),
    todoBreakdown({ ...ranged, user_id: userId }),
    countSafe(db.AttendanceUsers, { user_id: userId }),
    countSafe(db.Logs, { ...ranged, user_id: userId }),
    countSafe(db.Communications, {
      ...ranged,
      communication_type: "general",
      users: { [Op.iLike]: `%${userId}%` },
    }),
    db.UserAllowedDays.findAll({
      where: { user_id: userId },
      order: [["year", "DESC"]],
      limit: 5,
    }),
  ]);

  const [
    missionsRecent,
    leaveRecent,
    scheduleRecent,
    reqRecent,
    vehicleRecent,
    assetRecent,
    docRecent,
    reportRecent,
    mrRecent,
    commRecent,
    permRecent,
    ticketCreatedRecent,
    ticketAssignedRecent,
    todoRecent,
    logRecent,
    missionTrend,
    leaveTrend,
    reqTrend,
  ] = await Promise.all([
    recentRows(db.MissionRequests, { user_id: userId }, ["id", "destination", "mission_requests_status", "departure_date", "return_date", "created_at"]),
    recentRows(db.LeaveRequests, { user_id: userId }, ["id", "leave_type", "leave_requests_status", "leave_from", "return_date", "requested_days", "created_at"]),
    recentRows(db.LeaveSchedule, { user_id: userId }, ["id", "from_date", "return_date", "status", "created_at"]),
    recentRows(db.Requisitions, { prepared_by: userId }, ["id", "status", "total_amount_requested", "created_at"]),
    recentRows(db.SpecialRequisitions, { prepared_by: userId }, ["id", "title", "status", "type", "start_time", "end_time", "created_at"]),
    recentRows(db.Assets, { user_id: userId }, ["id", "name", "status", "serial_number", "created_at"]),
    recentRows(db.Documents, { created_by: userId }, ["id", "title", "status", "created_at"]),
    recentRows(db.Reports, { created_by: userId }, ["id", "title", "status", "created_at"]),
    recentRows(db.MembershipReports, { [Op.or]: [{ user_id: userId }, { submitted_by: userId }] }, ["id", "title", "report_type", "status", "created_at"]),
    recentRows(db.Communications, { communication_type: "general", created_by: userId }, ["id", "title", "communication_type", "created_at"]),
    recentRows(db.Communications, { communication_type: "permission", created_by: userId }, ["id", "title", "communication_type", "created_at"]),
    recentRows(db.Tickets, { created_by: userId }, ["id", "title", "status", "priority", "created_at"]),
    recentRows(db.Tickets, { assigned_to: userId }, ["id", "title", "status", "priority", "created_at"]),
    recentRows(db.UserTasks, { user_id: userId }, ["id", "title", "is_completed", "due_date", "created_at"]),
    recentRows(db.Logs, { user_id: userId }, ["id", "action", "description", "created_at"]),
    monthlyTrend(db.MissionRequests, { user_id: userId }, range.from, range.to),
    monthlyTrend(db.LeaveRequests, { user_id: userId }, range.from, range.to),
    monthlyTrend(db.Requisitions, { prepared_by: userId }, range.from, range.to),
  ]);

  const leaveProfile = leaveAnalytics.employees?.[0] || null;
  const activity = await countUserActivity(userId, ranged);

  const modules = [
    moduleBlock("missions", "Missions", "/dashboard/missions", missionsStats, missionsRecent),
    moduleBlock("leave_requests", "Leave Requests", "/dashboard/leave-requests", leaveStats, leaveRecent),
    moduleBlock("leave_schedule", "Leave Schedule", "/dashboard/leave-schedule", scheduleStats, scheduleRecent),
    moduleBlock("requisitions", "Requisitions", "/dashboard/requisitions", reqStats, reqRecent),
    moduleBlock("vehicle_utilization", "Vehicle Utilization", "/dashboard/special-requisitions", vehicleStats, vehicleRecent),
    moduleBlock("assets", "Assets", "/dashboard/assets", assetStats, assetRecent),
    moduleBlock("documents", "Documents", "/dashboard/documents", docStats, docRecent),
    moduleBlock("reports", "Staff Reports", "/dashboard/reports", reportStats, reportRecent),
    moduleBlock("membership_reports", "Membership Reports", "/dashboard/membership-reports", mrStats, mrRecent),
    moduleBlock("communications", "Communications", "/dashboard/communications", { ...commStats, received: commReceivedCount }, commRecent),
    moduleBlock("permissions", "Permissions", "/dashboard/permissions", permStats, permRecent),
    moduleBlock("tickets_created", "Tickets (created)", "/dashboard/tickets", ticketCreatedStats, ticketCreatedRecent),
    moduleBlock("tickets_assigned", "Tickets (assigned)", "/dashboard/tickets", ticketAssignedStats, ticketAssignedRecent),
    moduleBlock("todos", "Todos", "/dashboard/todos", todoStats, todoRecent),
    moduleBlock("attendance", "Attendance", "/dashboard/attendance", { total: attendanceCount }, []),
    moduleBlock("logs", "System Logs", "/dashboard/logs", { total: logCount }, logRecent),
  ];

  return {
    employee: user.toJSON(),
    period: {
      ...range,
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
    },
    activity,
    leave: {
      balance: leaveBalance,
      profile: leaveProfile,
      insights: leaveAnalytics.insights || [],
    },
    leave_allowance_years: leaveDays.map((row) => row.toJSON()),
    modules,
    trends: {
      missions: missionTrend,
      leave: leaveTrend,
      requisitions: reqTrend,
    },
    links: {
      leave_requests: "leave_requests",
      leave_schedule: "leave_schedule",
      missions: "missions",
      requisitions: "requisitions",
      vehicle: "vehicle_utilization",
      assets: "assets",
      reports: "reports",
      communications: "communications",
      permissions: "permissions",
      logs: "logs",
    },
  };
}
