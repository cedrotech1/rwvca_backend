import { Op } from "sequelize";
import db from "../database/models/index.js";
import { getLeaveBalance } from "../services/leaveBalanceService.js";

const ACTIVE_LEAVE_STATUSES = ["pending", "verified_by_hr", "approved"];

function normalizeSearch(value) {
  return String(value || "").trim();
}

export async function buildLeaveAnalytics(query = {}) {
  const year = Number(query.year) || new Date().getFullYear();
  const search = normalizeSearch(query.search);
  const departmentId = query.department_id ? Number(query.department_id) : null;
  const userId = query.user_id ? Number(query.user_id) : null;

  const userWhere = {
    deleted: { [Op.ne]: "1" },
    active: 1,
  };
  if (userId) userWhere.id = userId;
  if (departmentId) userWhere.department_ID = departmentId;
  if (search) {
    userWhere[Op.or] = [
      { names: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { role: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const users = await db.Users.findAll({
    where: userWhere,
    attributes: ["id", "names", "email", "role", "department_ID", "gender"],
    include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
    order: [["names", "ASC"]],
    limit: Math.min(Number(query.limit) || 200, 500),
  });

  const userIds = users.map((row) => row.id);
  if (!userIds.length) {
    return {
      summary: emptySummary(),
      by_status: [],
      by_type: [],
      utilization: [],
      employees: [],
      insights: [],
      schedules_pending: 0,
      unscheduled_requests: 0,
    };
  }

  const [requests, schedules, balancesEntries] = await Promise.all([
    db.LeaveRequests.findAll({
      where: { user_id: { [Op.in]: userIds }, year },
      order: [["created_at", "DESC"]],
    }),
    db.LeaveSchedule.findAll({
      where: { user_id: { [Op.in]: userIds } },
      order: [["from_date", "DESC"]],
    }),
    Promise.all(userIds.map(async (id) => [id, await getLeaveBalance(id)])),
  ]);

  const balanceMap = Object.fromEntries(balancesEntries);
  const requestsByUser = groupBy(requests, "user_id");
  const schedulesByUser = groupBy(schedules, "user_id");

  const byStatus = {};
  const byType = {};
  requests.forEach((row) => {
    const status = row.leave_requests_status || "unknown";
    byStatus[status] = (byStatus[status] || 0) + 1;
    const type = row.leave_type || "Unknown";
    byType[type] = (byType[type] || 0) + 1;
  });

  let totalDaysUsed = 0;
  let totalDaysAvailable = 0;
  let lowBalanceCount = 0;
  let onLeaveNow = 0;
  let unscheduledRequests = 0;
  const today = new Date().toISOString().slice(0, 10);

  const employees = users.map((user) => {
    const balance = balanceMap[user.id] || {};
    const userRequests = requestsByUser[user.id] || [];
    const userSchedules = schedulesByUser[user.id] || [];
    const approvedDays = userRequests
      .filter((row) => row.leave_requests_status === "approved")
      .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);
    const pendingDays = userRequests
      .filter((row) => ACTIVE_LEAVE_STATUSES.includes(row.leave_requests_status) && row.leave_requests_status !== "approved")
      .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);

    const activeLeave = userRequests.find(
      (row) =>
        ACTIVE_LEAVE_STATUSES.includes(row.leave_requests_status) &&
        String(row.leave_from).slice(0, 10) <= today &&
        String(row.return_date).slice(0, 10) >= today
    );

    const upcomingSchedule = userSchedules.find(
      (row) => ["pending", "approved"].includes(row.status) && String(row.return_date).slice(0, 10) >= today
    );

    const latestRequest = userRequests[0] || null;
    const missingSchedule = userRequests.filter((row) => {
      if (["reverted", "rejected"].includes(row.leave_requests_status)) return false;
      return !userSchedules.some(
        (schedule) =>
          ["pending", "approved"].includes(schedule.status) &&
          String(schedule.from_date).slice(0, 10) <= String(row.leave_from).slice(0, 10) &&
          String(schedule.return_date).slice(0, 10) >= String(row.return_date).slice(0, 10)
      );
    });

    totalDaysUsed += Number(balance.current_year_used || 0);
    totalDaysAvailable += Number(balance.total_available_days || 0);
    if (Number(balance.total_available_days || 0) <= 3) lowBalanceCount += 1;
    if (activeLeave) onLeaveNow += 1;
    unscheduledRequests += missingSchedule.length;

    const utilizationPct = balance.current_allowed
      ? Math.round((Number(balance.current_year_used || 0) / Number(balance.current_allowed)) * 100)
      : 0;

    return {
      user_id: user.id,
      names: user.names,
      email: user.email,
      role: user.role,
      department: user.department?.name || null,
      department_id: user.department_ID,
      balance,
      approved_days_ytd: approvedDays,
      pending_days: pendingDays,
      requests_count: userRequests.length,
      schedules_count: userSchedules.length,
      utilization_pct: utilizationPct,
      days_left: balance.total_available_days,
      current_status: activeLeave
        ? `On leave (${activeLeave.leave_type})`
        : latestRequest?.leave_requests_status === "pending"
          ? "Pending approval"
          : latestRequest?.leave_requests_status === "verified_by_hr"
            ? "Awaiting ED approval"
            : "Available",
      active_leave: activeLeave,
      upcoming_schedule: upcomingSchedule,
      latest_request: latestRequest,
      requests: userRequests.slice(0, 20),
      schedules: userSchedules.slice(0, 10),
      missing_schedule_count: missingSchedule.length,
    };
  });

  const utilization = employees
    .map((row) => ({
      label: row.names,
      value: row.utilization_pct,
      days_left: row.days_left,
      used: row.balance?.current_year_used || 0,
      allowed: row.balance?.current_allowed || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const schedulesPending = schedules.filter((row) => row.status === "pending").length;

  const insights = [
    {
      key: "on_leave",
      label: "Employees on leave today",
      value: onLeaveNow,
      tone: "sky",
    },
    {
      key: "low_balance",
      label: "Low balance (≤3 days)",
      value: lowBalanceCount,
      tone: "amber",
    },
    {
      key: "pending_schedules",
      label: "Schedules awaiting review",
      value: schedulesPending,
      tone: "violet",
    },
    {
      key: "unscheduled",
      label: "Requests without matching schedule",
      value: unscheduledRequests,
      tone: "rose",
    },
    {
      key: "pending_requests",
      label: "Pending leave requests",
      value: byStatus.pending || 0,
      tone: "orange",
    },
    {
      key: "approved_ytd",
      label: "Approved requests (year)",
      value: byStatus.approved || 0,
      tone: "emerald",
    },
  ];

  return {
    summary: {
      employees: employees.length,
      total_days_available: totalDaysAvailable,
      total_days_used: totalDaysUsed,
      on_leave_now: onLeaveNow,
      pending_schedules: schedulesPending,
      unscheduled_requests: unscheduledRequests,
      year,
    },
    by_status: Object.entries(byStatus).map(([label, value]) => ({ label, value })),
    by_type: Object.entries(byType).map(([label, value]) => ({ label, value })),
    utilization,
    employees,
    insights,
    schedules_pending: schedulesPending,
    unscheduled_requests: unscheduledRequests,
  };
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const id = row[key];
    if (!acc[id]) acc[id] = [];
    acc[id].push(row);
    return acc;
  }, {});
}

function emptySummary() {
  return {
    employees: 0,
    total_days_available: 0,
    total_days_used: 0,
    on_leave_now: 0,
    pending_schedules: 0,
    unscheduled_requests: 0,
    year: new Date().getFullYear(),
  };
}
