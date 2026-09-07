import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok } from "../utils/apiResponse.js";
import {
  isAdminRole,
  isAccountantRole,
  isExactHr,
  isExecutiveRole,
  isLogisticRole,
} from "../utils/roleHelpers.js";

const sequelize = db.sequelize;

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function periodRange(query) {
  const now = new Date();
  const period = String(query.period || "year").toLowerCase();
  const year = Number(query.year) || now.getFullYear();
  const month = query.month ? Number(query.month) : null;

  if (query.date_from && query.date_to) {
    return {
      period: "custom",
      from: new Date(`${query.date_from}T00:00:00`),
      to: new Date(`${query.date_to}T23:59:59`),
      year,
      month,
    };
  }
  if (period === "all") {
    return { period: "all", from: null, to: null, year, month: null };
  }
  if (period === "week") {
    const from = new Date(now);
    const day = from.getDay() || 7;
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - day + 1);
    return { period, from, to: now, year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  if (period === "month" || month) {
    const m = (month || now.getMonth() + 1) - 1;
    const y = month ? year : now.getFullYear();
    return {
      period: "month",
      from: new Date(y, m, 1),
      to: new Date(y, m + 1, 0, 23, 59, 59),
      year: y,
      month: m + 1,
    };
  }
  return {
    period: "year",
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31, 23, 59, 59),
    year,
    month: null,
  };
}

function dateWhere(from, to, field = "created_at") {
  if (!from || !to) return {};
  return { [field]: { [Op.between]: [from, to] } };
}

function financeReadyWhere(role) {
  const where = { status: { [Op.in]: ["approved", "authorized"] } };
  if (normalizeRole(role) === "assistant to ed") {
    where.total_amount_requested = { [Op.lt]: 100000 };
  }
  return where;
}

const CARD_META = {
  requisitions: { key: "requisitions", label: "Requisitions", path: "/dashboard/requisitions" },
  finance_requisitions: { key: "finance_requisitions", label: "Finance Requisitions", path: "/dashboard/finance-requisitions" },
  vehicle_utilization: { key: "vehicle_utilization", label: "Vehicle Utilization", path: "/dashboard/special-requisitions" },
  leave_requests: { key: "leave_requests", label: "Leave Requests", path: "/dashboard/leave-requests" },
  leave_schedule: { key: "leave_schedule", label: "Leave Schedule", path: "/dashboard/leave-schedule" },
  missions: { key: "missions", label: "Missions", path: "/dashboard/missions" },
  documents: { key: "documents", label: "Documents", path: "/dashboard/documents" },
  reports: { key: "reports", label: "Staff Reports", path: "/dashboard/reports" },
  membership_reports: { key: "membership_reports", label: "Membership Reports", path: "/dashboard/membership-reports" },
  tickets: { key: "tickets", label: "Tickets", path: "/dashboard/tickets" },
  assets: { key: "assets", label: "Assets", path: "/dashboard/assets" },
  todos: { key: "todos", label: "Todos", path: "/dashboard/todos" },
  communications: { key: "communications", label: "Communications", path: "/dashboard/communications" },
  permissions: { key: "permissions", label: "Permissions", path: "/dashboard/permissions" },
  attendance: { key: "attendance", label: "Attendance", path: "/dashboard/attendance" },
  users: { key: "users", label: "Users", path: "/dashboard/users" },
  members: { key: "members", label: "Members", path: "/dashboard/members" },
  inventory: { key: "inventory", label: "Inventory", path: "/dashboard/inventory" },
};

const MY_WORKFLOW = [
  "requisitions",
  "vehicle_utilization",
  "leave_requests",
  "leave_schedule",
  "missions",
  "documents",
  "reports",
  "membership_reports",
  "tickets",
  "assets",
  "todos",
  "communications",
  "permissions",
  "attendance",
];

const ALL_MANAGED = [
  ...MY_WORKFLOW,
  "users",
  "members",
  "inventory",
];

function dashboardProfile(role) {
  const value = normalizeRole(role);
  if (value === "ed" || value === "chairman") {
    return {
      key: "executive",
      label: "Organization",
      subtitle: "You manage every module, plus your own records.",
      sees_all: true,
      manage: ALL_MANAGED,
      cms: false,
      users: true,
      finance: true,
    };
  }
  if (value === "hr") {
    return {
      key: "hr",
      label: "HR operations",
      subtitle: "You manage staff workflow across the organization, plus your own records.",
      sees_all: true,
      manage: MY_WORKFLOW.concat(["users"]),
      cms: false,
      users: true,
      finance: false,
    };
  }
  if (value === "accountant") {
    return {
      key: "accountant",
      label: "Finance & HR operations",
      subtitle: "You manage staff workflow like HR, plus finance-ready requisitions and membership reports.",
      sees_all: true,
      manage: MY_WORKFLOW.concat(["users", "finance_requisitions", "membership_reports"]),
      cms: false,
      users: true,
      finance: true,
    };
  }
  if (value === "admin") {
    return {
      key: "admin",
      label: "Administration",
      subtitle: "Website, users, inventory, and the modules you work in.",
      sees_all: true,
      manage: ALL_MANAGED,
      cms: true,
      users: true,
      finance: false,
    };
  }
  if (value === "assistant to the accountant" || value === "assistant to ed") {
    return {
      key: "finance",
      label: value === "assistant to ed" ? "Petty cash finance" : "Finance",
      subtitle: value === "assistant to ed"
        ? "You manage petty cash requisitions and membership reports, plus your own work."
        : "You manage finance-ready requisitions and membership reports, plus your own work.",
      sees_all: false,
      manage: ["finance_requisitions", "membership_reports"],
      cms: false,
      users: false,
      finance: true,
      petty_cash_only: value === "assistant to ed",
    };
  }
  if (value === "logistic" || value === "membership coordinator" || value === "membership r. supervisor") {
    return {
      key: "logistics",
      label: "Operations",
      subtitle: "You manage members, inventory, and vehicle utilization, plus your own work.",
      sees_all: false,
      manage: ["inventory", "members", "vehicle_utilization", "membership_reports"],
      cms: false,
      users: false,
      finance: false,
    };
  }
  if (value === "membership_officer") {
    return {
      key: "membership",
      label: "Membership",
      subtitle: "You manage members, plus your own work.",
      sees_all: false,
      manage: ["members"],
      cms: false,
      users: false,
      finance: false,
    };
  }
  return {
    key: "staff",
    label: "My work",
    subtitle: "Your records across the modules you use.",
    sees_all: false,
    manage: [],
    cms: false,
    users: false,
    finance: false,
  };
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

function statusChartFromBreakdown(prefix, stats = {}) {
  const statuses = stats.statuses || {};
  const entries = Object.entries(statuses);
  if (!entries.length) {
    return [
      { label: `${prefix} pending`, value: stats.pending || 0 },
      { label: `${prefix} approved`, value: stats.approved || 0 },
    ].filter((item) => item.value > 0);
  }
  return entries
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([status, value]) => ({
      label: `${prefix} ${String(status).replace(/_/g, " ")}`,
      value: Number(value) || 0,
    }));
}

async function sumAmount(model, where, field = "total_amount_requested") {
  try {
    const sumRow = await model.findOne({
      attributes: [[sequelize.fn("coalesce", sequelize.fn("sum", sequelize.col(field)), 0), "total"]],
      where,
      raw: true,
    });
    return Number(sumRow?.total || 0);
  } catch {
    return 0;
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
    return rows.map((row) => ({
      month: row.month,
      count: Number(row.count || 0),
    }));
  } catch {
    return [];
  }
}

async function recentRows(model, where, attributes, extra = {}) {
  try {
    return await model.findAll({
      where,
      attributes,
      order: [["created_at", "DESC"]],
      limit: 5,
      ...extra,
    });
  } catch {
    return [];
  }
}

function card(key, stats = {}, extra = {}) {
  return {
    ...CARD_META[key],
    total: stats.total ?? 0,
    pending: stats.pending,
    approved: stats.approved,
    rejected: stats.rejected,
    statuses: stats.statuses || null,
    amount: stats.amount,
    ...extra,
  };
}

export const getDashboardOverview = asyncHandler(async (req, res) => {
  const range = periodRange(req.query);
  const userId = req.user.id;
  const profile = dashboardProfile(req.user.role);
  const ranged = dateWhere(range.from, range.to);
  const financeWhere = { ...ranged, ...financeReadyWhere(req.user.role) };

  const mineReq = { ...ranged, prepared_by: userId };
  const mineLeave = { ...ranged, user_id: userId };
  const mineMission = { ...ranged, user_id: userId };
  const mineVehicle = { ...ranged, prepared_by: userId };
  const mineDoc = { ...ranged, created_by: userId };
  const mineReport = { ...ranged, created_by: userId };
  const mineMr = { ...ranged, [Op.or]: [{ user_id: userId }, { submitted_by: userId }] };
  const mineTicket = { ...ranged, created_by: userId };
  const mineAsset = { ...ranged, user_id: userId };
  const mineTodo = { ...ranged, user_id: userId };
  const mineComm = { ...ranged, communication_type: "general", created_by: userId };
  const minePerm = { ...ranged, communication_type: "permission", created_by: userId };
  const mineSchedule = { ...ranged, user_id: userId };
  const mineAttendance = { ...ranged, created_by: userId };

  const orgReq = ranged;
  const orgLeave = ranged;
  const orgMission = ranged;
  const orgVehicle = ranged;
  const orgDoc = ranged;
  const orgReport = ranged;
  const orgMr = ranged;
  const orgTicket = ranged;
  const orgAsset = ranged;
  const orgTodo = ranged;
  const orgComm = { ...ranged, communication_type: "general" };
  const orgPerm = { ...ranged, communication_type: "permission" };
  const orgSchedule = ranged;
  const orgAttendanceWhere = ranged;

  const [
    myRequisitions,
    myVehicles,
    myLeaves,
    myMissions,
    myDocuments,
    myReports,
    myMembershipReports,
    myTickets,
    myAssets,
    myTodos,
    myCommunications,
    myPermissions,
    myLeaveSchedule,
    myAttendance,
    myReqAmount,
    orgRequisitions,
    orgVehicles,
    orgLeaves,
    orgMissions,
    orgDocuments,
    orgReports,
    orgMembershipReports,
    orgTickets,
    orgAssets,
    orgTodos,
    orgCommunications,
    orgPermissions,
    orgLeaveSchedule,
    orgAttendance,
    orgReqAmount,
    financeRequisitions,
    financeAmount,
    usersTotal,
    usersMale,
    usersFemale,
    usersActive,
    signatures,
    members,
    inventory,
    events,
    programs,
    gallery,
    ads,
    partners,
    platforms,
    contactMessages,
    subscribers,
    unread,
    edNotes,
  ] = await Promise.all([
    statusBreakdown(db.Requisitions, mineReq, "status"),
    statusBreakdown(db.SpecialRequisitions, mineVehicle, "status"),
    statusBreakdown(db.LeaveRequests, mineLeave, "leave_requests_status"),
    statusBreakdown(db.MissionRequests, mineMission, "mission_requests_status"),
    countSafe(db.Documents, mineDoc),
    countSafe(db.Reports, mineReport),
    statusBreakdown(db.MembershipReports, mineMr, "status"),
    statusBreakdown(db.Tickets, mineTicket, "status"),
    statusBreakdown(db.Assets, mineAsset, "status"),
    countSafe(db.UserTasks, mineTodo),
    countSafe(db.Communications, mineComm),
    countSafe(db.Communications, minePerm),
    countSafe(db.LeaveSchedule, mineSchedule),
    countSafe(db.Attendance, mineAttendance),
    sumAmount(db.Requisitions, mineReq),
    statusBreakdown(db.Requisitions, orgReq, "status"),
    statusBreakdown(db.SpecialRequisitions, orgVehicle, "status"),
    statusBreakdown(db.LeaveRequests, orgLeave, "leave_requests_status"),
    statusBreakdown(db.MissionRequests, orgMission, "mission_requests_status"),
    countSafe(db.Documents, orgDoc),
    countSafe(db.Reports, orgReport),
    statusBreakdown(db.MembershipReports, orgMr, "status"),
    statusBreakdown(db.Tickets, orgTicket, "status"),
    statusBreakdown(db.Assets, orgAsset, "status"),
    countSafe(db.UserTasks, orgTodo),
    countSafe(db.Communications, orgComm),
    countSafe(db.Communications, orgPerm),
    countSafe(db.LeaveSchedule, orgSchedule),
    countSafe(db.Attendance, orgAttendanceWhere),
    sumAmount(db.Requisitions, orgReq),
    statusBreakdown(db.Requisitions, financeWhere, "finance_status"),
    sumAmount(db.Requisitions, financeWhere),
    countSafe(db.Users, { deleted: { [Op.ne]: "1" } }),
    countSafe(db.Users, { deleted: { [Op.ne]: "1" }, gender: { [Op.iLike]: "male" } }),
    countSafe(db.Users, { deleted: { [Op.ne]: "1" }, gender: { [Op.iLike]: "female" } }),
    countSafe(db.Users, { deleted: { [Op.ne]: "1" }, active: 1 }),
    countSafe(db.Users, { deleted: { [Op.ne]: "1" }, signature_approved: "1" }),
    countSafe(db.Members, {}),
    countSafe(db.InventoryItems, {}),
    countSafe(db.Events, {}),
    countSafe(db.Programs, {}),
    countSafe(db.Gallery, {}),
    countSafe(db.Ads, {}),
    countSafe(db.Partners, {}),
    countSafe(db.Platforms, {}),
    countSafe(db.ContactMessages, { status: "unread" }),
    countSafe(db.Subscribers, { status: "active" }),
    countSafe(db.Notifications, { receiver_id: userId, status: "unread" }),
    countSafe(db.EdCommentRecipients, { user_id: userId, replied_at: null }),
  ]);

  const mineStats = {
    requisitions: { ...myRequisitions, amount: myReqAmount },
    vehicle_utilization: myVehicles,
    leave_requests: myLeaves,
    leave_schedule: { total: myLeaveSchedule },
    missions: myMissions,
    documents: { total: myDocuments },
    reports: { total: myReports },
    membership_reports: myMembershipReports,
    tickets: myTickets,
    assets: myAssets,
    todos: { total: myTodos },
    communications: { total: myCommunications },
    permissions: { total: myPermissions },
    attendance: { total: myAttendance },
  };

  const managedStats = {
    requisitions: { ...orgRequisitions, amount: orgReqAmount },
    finance_requisitions: {
      ...financeRequisitions,
      amount: financeAmount,
    },
    vehicle_utilization: orgVehicles,
    leave_requests: orgLeaves,
    leave_schedule: { total: orgLeaveSchedule },
    missions: orgMissions,
    documents: { total: orgDocuments },
    reports: { total: orgReports },
    membership_reports: orgMembershipReports,
    tickets: orgTickets,
    assets: orgAssets,
    todos: { total: orgTodos },
    communications: { total: orgCommunications },
    permissions: { total: orgPermissions },
    attendance: { total: orgAttendance },
    users: { total: usersTotal, pending: signatures, approved: usersActive, male: usersMale, female: usersFemale },
    members: { total: members },
    inventory: { total: inventory },
  };

  const mineCards = MY_WORKFLOW.map((key) => card(key, mineStats[key]));
  const managedCards = profile.manage.map((key) => {
    const extra = key === "users"
      ? { male: usersMale, female: usersFemale, active: usersActive, signatures }
      : {};
    return card(key, managedStats[key], extra);
  });

  const trendTo = range.to || new Date();
  const trendFrom = new Date(trendTo);
  trendFrom.setMonth(trendFrom.getMonth() - 5);
  trendFrom.setDate(1);

  const trendMissionWhere = profile.sees_all ? {} : { user_id: userId };
  const trendLeaveWhere = profile.sees_all ? {} : { user_id: userId };
  const trendReqWhere = profile.finance && !profile.sees_all
    ? financeReadyWhere(req.user.role)
    : profile.sees_all ? {} : { prepared_by: userId };

  const [missionTrend, leaveTrend, requisitionTrend] = await Promise.all([
    monthlyTrend(db.MissionRequests, trendMissionWhere, trendFrom, trendTo),
    monthlyTrend(db.LeaveRequests, trendLeaveWhere, trendFrom, trendTo),
    monthlyTrend(db.Requisitions, trendReqWhere, trendFrom, trendTo),
  ]);

  let departments = [];
  if (profile.users) {
    try {
      departments = await db.Users.findAll({
        attributes: [
          "department_ID",
          [sequelize.fn("count", sequelize.col("Users.id")), "count"],
        ],
        where: { deleted: { [Op.ne]: "1" }, department_ID: { [Op.ne]: null } },
        include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
        group: ["department_ID", "department.id", "department.name"],
        order: [[sequelize.fn("count", sequelize.col("Users.id")), "DESC"]],
        limit: 5,
        raw: true,
        nest: true,
      });
    } catch {
      departments = [];
    }
  }

  const recentReqWhere = profile.finance && !profile.sees_all ? financeWhere : (profile.sees_all ? orgReq : mineReq);
  const recentMissionWhere = profile.sees_all ? orgMission : mineMission;
  const recentLeaveWhere = profile.sees_all ? orgLeave : mineLeave;
  const recentAssetWhere = profile.sees_all ? orgAsset : mineAsset;
  const recentMrWhere = profile.manage.includes("membership_reports") ? orgMr : mineMr;
  const recentVehicleWhere = profile.sees_all || profile.manage.includes("vehicle_utilization")
    ? orgVehicle
    : mineVehicle;

  const [
    recentMissions,
    recentRequisitions,
    recentLeaves,
    recentAssets,
    recentMembershipReports,
    recentVehicles,
    recentMembers,
    recentInventory,
  ] = await Promise.all([
    recentRows(db.MissionRequests, recentMissionWhere, ["id", "destination", "purpose", "mission_requests_status", "created_at"]),
    recentRows(db.Requisitions, recentReqWhere, ["id", "status", "finance_status", "total_amount_requested", "created_at", "date"]),
    recentRows(db.LeaveRequests, recentLeaveWhere, ["id", "leave_type", "leave_requests_status", "created_at"]),
    recentRows(db.Assets, recentAssetWhere, ["id", "name", "status", "created_at"]),
    recentRows(db.MembershipReports, recentMrWhere, ["id", "status", "report_type", "created_at"]),
    recentRows(db.SpecialRequisitions, recentVehicleWhere, ["id", "title", "type", "status", "created_at"]),
    profile.manage.includes("members")
      ? recentRows(db.Members, {}, ["id", "company_name", "owner_name", "membership_status", "date_joined"], { order: [["id", "DESC"]] })
      : [],
    profile.manage.includes("inventory")
      ? recentRows(db.InventoryItems, {}, ["id", "name", "category", "current_quantity", "created_at"])
      : [],
  ]);

  const statusChart = [];
  if (profile.manage.includes("missions") || profile.sees_all) {
    statusChart.push(...statusChartFromBreakdown("Missions", orgMissions));
  } else {
    statusChart.push(...statusChartFromBreakdown("My missions", myMissions));
  }
  if (profile.manage.includes("leave_requests") || profile.sees_all) {
    statusChart.push(...statusChartFromBreakdown("Leave", orgLeaves));
  } else {
    statusChart.push(...statusChartFromBreakdown("My leave", myLeaves));
  }
  if (profile.manage.includes("finance_requisitions")) {
    statusChart.push(...statusChartFromBreakdown("Finance", financeRequisitions));
  } else if (profile.manage.includes("requisitions") || profile.sees_all) {
    statusChart.push(...statusChartFromBreakdown("Requisitions", orgRequisitions));
  } else {
    statusChart.push(...statusChartFromBreakdown("My requisitions", myRequisitions));
  }

  const counts = {
    requisitions: profile.sees_all ? orgRequisitions.total : myRequisitions.total,
    finance_requisitions: financeRequisitions.total,
    vehicle_utilization: profile.sees_all || profile.manage.includes("vehicle_utilization") ? orgVehicles.total : myVehicles.total,
    leave_requests: profile.sees_all ? orgLeaves.total : myLeaves.total,
    leave_schedule: profile.sees_all ? orgLeaveSchedule : myLeaveSchedule,
    missions: profile.sees_all ? orgMissions.total : myMissions.total,
    documents: profile.sees_all ? orgDocuments : myDocuments,
    reports: profile.sees_all ? orgReports : myReports,
    membership_reports: profile.manage.includes("membership_reports") || profile.sees_all ? orgMembershipReports.total : myMembershipReports.total,
    members,
    tickets: profile.sees_all ? orgTickets.total : myTickets.total,
    todos: profile.sees_all ? orgTodos : myTodos,
    communications: profile.sees_all ? orgCommunications : myCommunications,
    permissions: profile.sees_all ? orgPermissions : myPermissions,
    assets: profile.sees_all ? orgAssets.total : myAssets.total,
    inventory,
    attendance: profile.sees_all ? orgAttendance : myAttendance,
    users: usersTotal,
    notifications_unread: unread,
    ed_notes_unreplied: edNotes,
  };

  return ok(res, {
    profile,
    period: {
      key: range.period,
      from: range.from,
      to: range.to,
      year: range.year,
      month: range.month,
    },
    counts,
    cards: {
      managed: managedCards,
      mine: mineCards,
    },
    charts: {
      show_gender: profile.users,
      show_departments: profile.users,
      gender: [
        { label: "Male", value: usersMale },
        { label: "Female", value: usersFemale },
      ],
      departments: departments.map((row) => ({
        label: row.department?.name || `Dept ${row.department_ID}`,
        value: Number(row.count || 0),
      })),
      status: statusChart.filter((item) => item.value > 0 || true),
      trends: {
        missions: missionTrend,
        leave: leaveTrend,
        requisitions: requisitionTrend,
      },
    },
    recents: {
      missions: recentMissions,
      requisitions: recentRequisitions,
      leave_requests: recentLeaves,
      assets: recentAssets,
      membership_reports: recentMembershipReports,
      vehicle_utilization: recentVehicles,
      members: recentMembers,
      inventory: recentInventory,
    },
    cms: profile.cms ? {
      events,
      programs,
      gallery,
      ads,
      partners,
      platforms,
      contact_messages: contactMessages,
      subscribers,
    } : null,
    capabilities: {
      can_manage_users: profile.users || isExactHr(req.user.role) || isAdminRole(req.user.role),
      can_manage_finance: profile.finance || isAccountantRole(req.user.role),
      can_manage_cms: profile.cms || isAdminRole(req.user.role),
      can_see_all: profile.sees_all || isExecutiveRole(req.user.role),
      can_manage_logistics: isLogisticRole(req.user.role),
    },
  });
});
