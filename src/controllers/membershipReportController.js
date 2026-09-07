import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { USER_PUBLIC } from "../services/workflowUsers.js";
import { isAdminRole, isAccountantRole, isExecutiveRole, isLogisticRole, isExactHr, canReviewWorkflow } from "../utils/roleHelpers.js";
import { requireNotificationPriority } from "../utils/notificationPriority.js";
import { buildMembershipAnalytics } from "../services/membershipAnalyticsService.js";

const USER_ATTR = { attributes: [...USER_PUBLIC, "working_area"] };
const REPORT_TYPES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];

const PAYMENT_METHODS = [
  "MOMO",
  "CASH",
  "NOT_INVOICED",
  "BANK",
  "MEMBERSHIP_FEES_REGISTRETION",
  "MEMBERSHIP_FEES_CONTRIBUTION",
];

function canManage(role) {
  const value = String(role || "").trim().toLowerCase();
  return (
    isAdminRole(role) ||
    isExecutiveRole(role) ||
    isLogisticRole(role) ||
    isAccountantRole(role) ||
    value === "membership r. supervisor"
  );
}

function applyReportFilters(where, query = {}) {
  const reportType = String(query.report_type || "").trim().toUpperCase();
  const location = String(query.location || "").trim();
  const startDate = String(query.start_date || query.daily_date || "").trim();
  const endDate = String(query.end_date || "").trim();
  const monthlyMonth = String(query.monthly_month || query.month_name || "").trim();
  const yearlyYear = String(query.yearly_year || "").trim();
  const quarter = String(query.quarter || "").trim();
  const search = String(query.search || "").trim();

  if (REPORT_TYPES.includes(reportType)) where.report_type = reportType;
  if (query.status) where.status = String(query.status).toUpperCase();
  if (location && location.toLowerCase() !== "all locations") where.location = location;
  if (query.year) where.year = query.year;

  switch (reportType) {
    case "DAILY":
      if (startDate) where.start_date = startDate;
      break;
    case "WEEKLY":
      if (startDate) where.start_date = { [Op.gte]: startDate };
      if (endDate) where.end_date = { [Op.lte]: endDate };
      break;
    case "MONTHLY":
      if (monthlyMonth) where.monthly_month = monthlyMonth;
      if (yearlyYear) where.yearly_year = yearlyYear;
      break;
    case "QUARTERLY":
      if (quarter) where.quarter = quarter;
      if (yearlyYear) where.yearly_year = yearlyYear;
      break;
    case "YEARLY":
      if (yearlyYear) where.yearly_year = yearlyYear;
      break;
    default:
      if (startDate && endDate) {
        where.created_at = {
          [Op.between]: [new Date(`${startDate}T00:00:00`), new Date(`${endDate}T23:59:59`)],
        };
      }
  }

  if (search) where.title = { [Op.iLike]: `%${search}%` };
  return where;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function canApprove(role) {
  return String(role || "").trim().toLowerCase() === "accountant";
}

function canAssignReviewers(role) {
  return canApprove(role) || canManage(role);
}

function membershipReportLink(id) {
  return `/dashboard/membership-reports/${id}`;
}

function shareRolePriority(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "ed") return 0;
  if (value === "chairman") return 1;
  if (value === "accountant") return 2;
  if (value === "membership r. supervisor") return 3;
  if (value.includes("membership")) return 4;
  if (value === "hr") return 5;
  return 10;
}

function toNumber(value) {
  if (value == null || value === "") return 0;
  const amount = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(amount) ? 0 : amount;
}

async function addMrLog(reportId, status, userId, comment) {
  await db.MembershipReportLogs.create({
    report_id: reportId,
    status,
    user_id: userId,
    comment: comment || null,
  });
}

async function loadReport(id) {
  return db.MembershipReports.findByPk(id, {
    include: [
      { model: db.Users, as: "user", ...USER_ATTR },
      { model: db.Users, as: "submitter", ...USER_ATTR },
      { model: db.Users, as: "approver", ...USER_ATTR },
      { model: db.MembershipReportItems, as: "items" },
      { model: db.MembershipReportPayments, as: "payments" },
      { model: db.CustomersNoInvoice, as: "customers" },
      {
        model: db.MembershipReportComments,
        as: "comments",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
      },
      {
        model: db.MembershipReportLogs,
        as: "logs",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
      },
      {
        model: db.MembershipReportReviewers,
        as: "reviewers",
        include: [
          { model: db.Users, as: "reviewer", attributes: ["id", "names", "email", "role"] },
          { model: db.Users, as: "assigner", attributes: ["id", "names", "email", "role"] },
        ],
      },
      { model: db.MembershipReportViewers, as: "viewers" },
    ],
    order: [[{ model: db.MembershipReportLogs, as: "logs" }, "created_at", "DESC"]],
  });
}

function reportPermissions(user, row) {
  const reviewerRow = (row.reviewers || []).find((item) => Number(item.reviewer_id) === Number(user.id));
  return {
    can_edit: Number(row.submitted_by) === Number(user.id) && row.status === "REVERTED",
    can_approve: canApprove(user.role) && row.status !== "APPROVED",
    can_revert: canApprove(user.role) && row.status !== "REVERTED",
    can_assign: canAssignReviewers(user.role),
    can_remove_reviewer: canAssignReviewers(user.role),
    can_review: Boolean(reviewerRow) && reviewerRow.status !== "REVIEWED",
    reviewer_status: reviewerRow?.status || null,
  };
}

async function canAccess(user, row) {
  if (canManage(user.role)) return true;
  if (Number(row.user_id) === Number(user.id) || Number(row.submitted_by) === Number(user.id)) return true;
  const reviewer = await db.MembershipReportReviewers.findOne({
    where: { report_id: row.id, reviewer_id: user.id },
  });
  if (reviewer) return true;
  const viewer = await db.MembershipReportViewers.findOne({
    where: { report_id: row.id, user_id: user.id },
  });
  return Boolean(viewer);
}

export const getMembershipReports = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req, { page: 1, limit: 50, max: 500 });
  const tab = req.query.tab || "my";
  const where = {};

  if (tab === "all" && canManage(req.user.role)) {
    // full access sees every report, matching PHP my-reports.php
  } else if (tab === "review") {
    const assigned = await db.MembershipReportReviewers.findAll({
      where: { reviewer_id: req.user.id },
      attributes: ["report_id"],
    });
    where.id = { [Op.in]: assigned.length ? assigned.map((row) => row.report_id) : [0] };
  } else {
    const assigned = await db.MembershipReportReviewers.findAll({
      where: { reviewer_id: req.user.id },
      attributes: ["report_id"],
    });
    const assignedIds = assigned.map((row) => row.report_id);
    where[Op.or] = [
      { user_id: req.user.id },
      { submitted_by: req.user.id },
      ...(assignedIds.length ? [{ id: { [Op.in]: assignedIds } }] : []),
    ];
  }

  applyReportFilters(where, req.query);

  const { rows, count } = await db.MembershipReports.findAndCountAll({
    where,
    include: [
      { model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] },
      { model: db.Users, as: "submitter", attributes: ["id", "names", "email", "role"] },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  const now = new Date();
  const weekStart = startOfDay(new Date(now));
  weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [thisWeek, thisMonth, thisYear] = await Promise.all([
    db.MembershipReports.count({ where: { ...where, created_at: { [Op.gte]: weekStart } } }),
    db.MembershipReports.count({ where: { ...where, created_at: { [Op.gte]: monthStart } } }),
    db.MembershipReports.count({ where: { ...where, created_at: { [Op.gte]: yearStart } } }),
  ]);

  return ok(res, {
    items: rows,
    pagination: paginationMeta(count, page, limit),
    stats: { total: count, this_week: thisWeek, this_month: thisMonth, this_year: thisYear },
    can_view_coverage: canManage(req.user.role),
  });
});

function canSeeMembershipAnalytics(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "hr") return false;
  return (
    canManage(role) ||
    isAccountantRole(role) ||
    canReviewWorkflow(role) ||
    value.includes("membership")
  );
}

function canCreateMembershipReportRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return [
    "membership relations officer",
    "membership_officer",
    "membership officer",
    "membership r. supervisor",
  ].includes(value);
}

function buildReportSummary(reports = []) {
  const allItems = [];
  const allPayments = [];
  const allCustomers = [];
  const reportersMap = new Map();
  const byDistrict = {};
  const bySite = {};

  for (const report of reports) {
    const items = report.items || [];
    const payments = report.payments || [];
    const customers = report.customers || [];
    allItems.push(...items);
    allPayments.push(...payments);
    allCustomers.push(...customers);

    const reporter = report.user || report.submitter;
    if (reporter?.id) {
      reportersMap.set(Number(reporter.id), {
        id: reporter.id,
        names: reporter.names,
        role: reporter.role,
        signature_url: reporter.signature_url,
        working_area: reporter.working_area,
        location: report.location || reporter.working_area || null,
      });
    }

    const district = String(report.location || "Unspecified").trim() || "Unspecified";
    byDistrict[district] = (byDistrict[district] || 0) + 1;

    const siteKey = reporter?.names
      ? `${reporter.names}${reporter.working_area ? ` (${reporter.working_area})` : ""}`
      : "Unassigned site";
    bySite[siteKey] = (bySite[siteKey] || 0) + 1;
  }

  const normalItems = allItems.filter((row) => String(row.category || "").toUpperCase() === "NORMAL");
  const otherItems = allItems.filter((row) => String(row.category || "").toUpperCase() === "OTHER");

  const paymentTotals = {};
  for (const method of PAYMENT_METHODS) paymentTotals[method] = 0;
  for (const row of allPayments) {
    const method = String(row.method || "").toUpperCase();
    paymentTotals[method] = (paymentTotals[method] || 0) + toNumber(row.amount);
  }

  const timberGroups = {};
  for (const row of allItems) {
    const name = row.timber_name || "—";
    const qty = toNumber(row.number_of_timber);
    if (qty > 0) timberGroups[name] = (timberGroups[name] || 0) + qty;
  }

  const totalCost = allItems.reduce((sum, row) => sum + toNumber(row.total_cost), 0);
  const totalVat = allItems.reduce((sum, row) => sum + toNumber(row.vat), 0);
  const totalMsf = normalItems.reduce((sum, row) => sum + toNumber(row.msf), 0);
  const totalMst = otherItems.reduce((sum, row) => sum + toNumber(row.mst), 0);
  const totalVatMsf = normalItems.reduce((sum, row) => sum + toNumber(row.vat_and_msf), 0)
    + otherItems.reduce((sum, row) => sum + toNumber(row.vat_and_mst), 0);
  const totalPayments = Object.values(paymentTotals).reduce((sum, value) => sum + value, 0);
  const totalCustomers = allCustomers.reduce((sum, row) => sum + toNumber(row.amount), 0);

  return {
    report_count: reports.length,
    item_count: allItems.length,
    customer_count: allCustomers.length,
    total_timber: allItems.reduce((sum, row) => sum + toNumber(row.number_of_timber), 0),
    total_cost: totalCost,
    total_vat: totalVat,
    total_msf: totalMsf,
    total_mst: totalMst,
    total_msf_mst: totalMsf + totalMst,
    total_vat_msf: totalVatMsf,
    total_payments: totalPayments,
    total_customers: totalCustomers,
    payments_by_method: paymentTotals,
    timber_by_name: timberGroups,
    by_district: byDistrict,
    by_site: bySite,
    reporters: [...reportersMap.values()],
  };
}

async function buildAccessibleReportWhere(user, query = {}) {
  const where = {};
  const tab = query.tab || (canManage(user.role) ? "all" : "my");

  if (tab === "all" && canManage(user.role)) {
    // managers see all reports
  } else if (tab === "review") {
    const assigned = await db.MembershipReportReviewers.findAll({
      where: { reviewer_id: user.id },
      attributes: ["report_id"],
    });
    where.id = { [Op.in]: assigned.length ? assigned.map((row) => row.report_id) : [0] };
  } else {
    const assigned = await db.MembershipReportReviewers.findAll({
      where: { reviewer_id: user.id },
      attributes: ["report_id"],
    });
    const assignedIds = assigned.map((row) => row.report_id);
    where[Op.or] = [
      { user_id: user.id },
      { submitted_by: user.id },
      ...(assignedIds.length ? [{ id: { [Op.in]: assignedIds } }] : []),
    ];
  }

  applyReportFilters(where, query);

  const groupBy = String(query.group_by || "").trim().toLowerCase();
  const siteUserId = Number(query.site_user_id || query.site || 0);
  if (groupBy === "site" && siteUserId) {
    where.user_id = siteUserId;
  }

  return { where, groupBy, siteUserId };
}

export const getMembershipReportPrintOptions = asyncHandler(async (req, res) => {
  const { where } = await buildAccessibleReportWhere(req.user, {
    ...req.query,
    location: "",
    site_user_id: "",
    site: "",
    search: "",
    group_by: "",
  });

  const rows = await db.MembershipReports.findAll({
    where,
    attributes: ["id", "location", "user_id", "submitted_by"],
    include: [
      { model: db.Users, as: "user", attributes: ["id", "names", "role", "working_area", "signature_url"] },
      { model: db.Users, as: "submitter", attributes: ["id", "names", "role", "working_area", "signature_url"] },
    ],
    order: [["created_at", "DESC"]],
    limit: 1000,
  });

  const districts = [...new Set(rows.map((row) => row.location).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sitesMap = new Map();
  for (const row of rows) {
    const reporter = row.user || row.submitter;
    if (!reporter?.id) continue;
    sitesMap.set(Number(reporter.id), {
      id: reporter.id,
      names: reporter.names,
      role: reporter.role,
      working_area: reporter.working_area || null,
      label: reporter.working_area
        ? `${reporter.names} — ${reporter.working_area}`
        : reporter.names,
    });
  }

  return ok(res, {
    districts,
    sites: [...sitesMap.values()].sort((a, b) => String(a.names).localeCompare(String(b.names))),
  });
});

export const getMembershipReportPrintBundle = asyncHandler(async (req, res) => {
  const groupBy = String(req.query.group_by || "district").trim().toLowerCase();
  if (!["district", "site"].includes(groupBy)) {
    return fail(res, "group_by must be district or site");
  }

  if (groupBy === "district" && !String(req.query.location || "").trim()) {
    return fail(res, "Select a district to generate the report");
  }
  if (groupBy === "site" && !Number(req.query.site_user_id || req.query.site || 0)) {
    return fail(res, "Select a site / officer to generate the report");
  }

  const { where } = await buildAccessibleReportWhere(req.user, { ...req.query, group_by: groupBy });

  const reports = await db.MembershipReports.findAll({
    where,
    include: [
      { model: db.Users, as: "user", attributes: ["id", "names", "email", "role", "signature_url", "working_area"] },
      { model: db.Users, as: "submitter", attributes: ["id", "names", "email", "role", "signature_url", "working_area"] },
      { model: db.Users, as: "approver", attributes: ["id", "names", "email", "role", "signature_url", "working_area"] },
      { model: db.MembershipReportItems, as: "items" },
      { model: db.MembershipReportPayments, as: "payments" },
      { model: db.CustomersNoInvoice, as: "customers" },
    ],
    order: [["created_at", "ASC"]],
    limit: 500,
  });

  const summary = buildReportSummary(reports);
  const first = reports[0];
  const siteReporter = summary.reporters[0] || null;

  return ok(res, {
    meta: {
      group_by: groupBy,
      location: groupBy === "district" ? String(req.query.location || "").trim() : (siteReporter?.location || null),
      site: groupBy === "site" ? siteReporter : null,
      report_type: req.query.report_type || null,
      status: req.query.status || null,
      period: {
        start_date: req.query.start_date || null,
        end_date: req.query.end_date || null,
        monthly_month: req.query.monthly_month || null,
        yearly_year: req.query.yearly_year || null,
        quarter: req.query.quarter || null,
      },
      generated_at: new Date(),
      generated_by: {
        id: req.user.id,
        names: req.user.names,
        role: req.user.role,
        signature_url: req.user.signature_url || null,
      },
      report_count: reports.length,
      title: groupBy === "district"
        ? `Membership Report by District — ${String(req.query.location || "").trim()}`
        : `Membership Report by Site — ${siteReporter?.names || "Officer"}`,
    },
    summary,
    reports,
    sample_period: first ? {
      report_type: first.report_type,
      start_date: first.start_date,
      end_date: first.end_date,
      monthly_month: first.monthly_month,
      yearly_year: first.yearly_year,
      quarter: first.quarter,
      year: first.year,
    } : null,
  });
});

export const getMembershipAnalytics = asyncHandler(async (req, res) => {
  if (!canSeeMembershipAnalytics(req.user.role)) return fail(res, "Access denied", 403);
  const mine = !canManage(req.user.role) && !canReviewWorkflow(req.user.role) && !isExactHr(req.user.role);
  const query = { ...req.query };
  if (mine) {
    query.user_id = req.user.id;
    query.mine = "1";
  }
  return ok(res, await buildMembershipAnalytics(query));
});

export const getMembershipReportShareUsers = asyncHandler(async (req, res) => {
  if (!canAssignReviewers(req.user.role)) {
    return fail(res, "You don't have permission to share membership reports", 403);
  }

  const executives = await db.Users.findAll({
    where: {
      active: 1,
      deleted: { [Op.ne]: "1" },
      [Op.or]: [
        { role: { [Op.iLike]: "ed" } },
        { role: { [Op.iLike]: "chairman" } },
      ],
    },
    attributes: ["id", "names", "email", "role", "department_ID", "working_area"],
    order: [["names", "ASC"]],
  });

  // Broader active staff list (ordered by name so early ED accounts are never truncated by newest-first limits)
  const staff = await db.Users.findAll({
    where: {
      active: 1,
      deleted: { [Op.ne]: "1" },
      id: { [Op.ne]: req.user.id },
      role: { [Op.notILike]: "admin" },
    },
    attributes: ["id", "names", "email", "role", "department_ID", "working_area"],
    order: [["names", "ASC"]],
    limit: 500,
  });

  const byId = new Map();
  [...executives, ...staff].forEach((row) => {
    byId.set(Number(row.id), row.toJSON ? row.toJSON() : row);
  });

  const items = [...byId.values()].sort((a, b) => {
    const rank = shareRolePriority(a.role) - shareRolePriority(b.role);
    if (rank !== 0) return rank;
    return String(a.names || "").localeCompare(String(b.names || ""));
  });

  return ok(res, {
    items,
    executives: items.filter((row) => isExecutiveRole(row.role)),
  });
});

function membershipMissedShareLink(id) {
  return `/dashboard/membership-reports/shared-missed/${id}`;
}

async function ensureMissedSharesTable() {
  try {
    await db.MembershipMissedShares.sync();
    if (db.MembershipMissedShareComments) {
      await db.MembershipMissedShareComments.sync();
    }
    await db.sequelize.query(`
      ALTER TABLE membership_missed_shares
      ADD COLUMN IF NOT EXISTS seen_at TIMESTAMP WITH TIME ZONE
    `);
  } catch {
    /* table may already exist */
  }
}

function canAccessMissedShare(user, row) {
  return Number(row.shared_to) === Number(user.id)
    || Number(row.shared_by) === Number(user.id)
    || isExecutiveRole(user.role)
    || canManage(user.role);
}

async function loadMissedShare(id) {
  return db.MembershipMissedShares.findByPk(id, {
    include: [
      { model: db.Users, as: "sharer", attributes: ["id", "names", "email", "role"] },
      { model: db.Users, as: "recipient", attributes: ["id", "names", "email", "role"] },
      {
        model: db.MembershipMissedShareComments,
        as: "comments",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
        separate: true,
        order: [["created_at", "ASC"]],
      },
    ],
  });
}

async function buildMembershipCoverage(query = {}) {
  const reportType = String(query.report_type || "").trim().toUpperCase();
  if (!REPORT_TYPES.includes(reportType)) {
    throw new Error("Select a report type to see who missed reporting");
  }

  const officers = await db.Users.findAll({
    where: {
      active: 1,
      [Op.or]: [
        { role: { [Op.iLike]: "membership relations officer" } },
        { role: { [Op.iLike]: "membership_officer" } },
        { role: { [Op.iLike]: "membership officer" } },
      ],
    },
    attributes: ["id", "names", "email", "role", "working_area"],
    order: [["names", "ASC"]],
  });

  const reportWhere = {};
  applyReportFilters(reportWhere, { ...query, search: "", status: "" });
  const reports = await db.MembershipReports.findAll({
    where: reportWhere,
    order: [["created_at", "DESC"]],
  });

  const latestByUser = new Map();
  reports.forEach((report) => {
    const userId = Number(report.user_id);
    if (!latestByUser.has(userId)) latestByUser.set(userId, report);
  });

  const selectedUser = query.user_id;
  const items = officers
    .filter((officer) => !selectedUser || Number(officer.id) === Number(selectedUser))
    .map((officer) => {
      const report = latestByUser.get(Number(officer.id));
      const submitted = Boolean(report);
      const updated = Boolean(
        submitted && report.updated_at && report.created_at && new Date(report.updated_at) > new Date(report.created_at)
      );
      return {
        user_id: officer.id,
        user_name: officer.names,
        email: officer.email,
        working_area: officer.working_area,
        id: report?.id || null,
        title: report?.title || "No Report Submitted",
        location: report?.location || officer.working_area || "N/A",
        report_type: report?.report_type || reportType,
        start_date: report?.start_date || null,
        end_date: report?.end_date || null,
        monthly_month: report?.monthly_month || null,
        yearly_year: report?.yearly_year || null,
        quarter: report?.quarter || null,
        created_at: report?.created_at || null,
        status: submitted ? (updated ? "updated" : "completed") : "pending",
        submitted,
        missed: !submitted,
      };
    });

  const missedOnly = String(query.missed_only || "1") !== "0";
  const visible = missedOnly ? items.filter((item) => item.missed) : items;

  return {
    items: visible,
    all_items: items,
    summary: {
      officers: items.length,
      submitted: items.filter((item) => item.submitted).length,
      missed: items.filter((item) => item.missed).length,
    },
    filters: {
      report_type: reportType,
      location: query.location || null,
      start_date: query.start_date || null,
      end_date: query.end_date || null,
      monthly_month: query.monthly_month || null,
      yearly_year: query.yearly_year || null,
      quarter: query.quarter || null,
    },
  };
}

export const getMembershipReportCoverage = asyncHandler(async (req, res) => {
  if (!canManage(req.user.role)) return fail(res, "Access denied", 403);
  try {
    const data = await buildMembershipCoverage({ ...req.query, missed_only: "0" });
    return ok(res, {
      items: data.all_items,
      summary: data.summary,
      filters: data.filters,
    });
  } catch (err) {
    return fail(res, err.message || "Could not load coverage");
  }
});

export const createMembershipMissedShare = asyncHandler(async (req, res) => {
  if (!canManage(req.user.role)) return fail(res, "Access denied", 403);
  await ensureMissedSharesTable();

  const body = req.body || {};
  const recipientIds = Array.isArray(body.shared_to_ids)
    ? body.shared_to_ids
    : body.shared_to
      ? [body.shared_to]
      : [];
  const note = String(body.note || body.reason || "").trim();
  if (!recipientIds.length) return fail(res, "Select ED / recipient to share with");
  const priority = requireNotificationPriority(body);
  if (!priority) return fail(res, "Select notification priority (Send as: Urgent / High / Middle / Low)");

  let coverage;
  try {
    coverage = await buildMembershipCoverage({
      ...(body.filters || body),
      missed_only: "1",
    });
  } catch (err) {
    return fail(res, err.message || "Could not build missed list");
  }

  if (!coverage.items.length) {
    return fail(res, "No missed officers for the selected filters");
  }

  const recipients = await db.Users.findAll({
    where: {
      id: { [Op.in]: recipientIds.map((id) => Number(id)).filter(Boolean) },
      active: 1,
      deleted: { [Op.ne]: "1" },
    },
    attributes: ["id", "names", "email", "role"],
  });
  if (!recipients.length) return fail(res, "No valid recipients found");

  const executiveRecipients = recipients.filter((row) => isExecutiveRole(row.role));
  if (!executiveRecipients.length) {
    return fail(res, "Missed lists can only be shared with ED / Chairman");
  }

  const createdShares = [];
  for (const recipient of executiveRecipients) {
    const row = await db.MembershipMissedShares.create({
      shared_by: req.user.id,
      shared_to: recipient.id,
      title: body.title || `Missed membership reports — ${coverage.filters.report_type}`,
      note: note || null,
      filters: coverage.filters,
      snapshot: {
        summary: coverage.summary,
        items: coverage.items,
        shared_at: new Date(),
      },
      link_path: "/dashboard/membership-reports/shared-missed/pending",
      status: "PENDING",
    });
    const link = membershipMissedShareLink(row.id);
    await row.update({ link_path: link });

    await createNotification({
      whatsapp: true,
      receiverId: recipient.id,
      type: "membership_missed_share",
      title: `Missed reports list shared (${coverage.summary.missed} missed)`,
      message: note || `${req.user.names} shared a filtered missed membership reports list with you.`,
      link,
      priority,
      emailPayload: buildEmailPayload("membership_report", {
        id: row.id,
        title: row.title,
        location: coverage.filters.location,
        report_type: coverage.filters.report_type,
      }, {
        intro: `${req.user.names} shared a missed membership reports list with you.`,
        actor: req.user,
        note: note || `${coverage.summary.missed} officer(s) missed reporting.`,
        actionRequired: "Open the shared missed list from this notification.",
      }),
    });

    createdShares.push({
      ...(row.toJSON ? row.toJSON() : row),
      link_path: link,
      recipient,
    });
  }

  return created(res, {
    items: createdShares,
    summary: coverage.summary,
    filters: coverage.filters,
  }, "Missed list shared with ED");
});

export const getMembershipMissedShares = asyncHandler(async (req, res) => {
  await ensureMissedSharesTable();
  const tab = String(req.query.tab || "received").toLowerCase();
  const where = {};

  if (tab === "sent") {
    // Only managers may list shares they sent; others get an empty list (no 403 on the reports page).
    if (!canManage(req.user.role) && !isExecutiveRole(req.user.role)) {
      return ok(res, { items: [] });
    }
    where.shared_by = req.user.id;
  } else {
    // Received lists are only for the designated recipient (typically ED).
    where.shared_to = req.user.id;
  }

  const rows = await db.MembershipMissedShares.findAll({
    where,
    include: [
      { model: db.Users, as: "sharer", attributes: ["id", "names", "email", "role"] },
      { model: db.Users, as: "recipient", attributes: ["id", "names", "email", "role"] },
    ],
    order: [["created_at", "DESC"]],
    limit: 100,
  });

  return ok(res, {
    items: rows.map((row) => {
      const json = row.toJSON ? row.toJSON() : row;
      return {
        ...json,
        missed_count: Number(json.snapshot?.summary?.missed || json.snapshot?.items?.length || 0),
        link_path: json.link_path || membershipMissedShareLink(json.id),
      };
    }),
  });
});

export const getMembershipMissedShare = asyncHandler(async (req, res) => {
  await ensureMissedSharesTable();
  const row = await loadMissedShare(req.params.id);
  if (!row) return fail(res, "Shared missed list not found", 404);
  if (!canAccessMissedShare(req.user, row)) return fail(res, "Access denied", 403);

  if (Number(row.shared_to) === Number(req.user.id) && row.status === "PENDING") {
    await row.update({ status: "OPENED", opened_at: new Date() });
    await row.reload({
      include: [
        { model: db.Users, as: "sharer", attributes: ["id", "names", "email", "role"] },
        { model: db.Users, as: "recipient", attributes: ["id", "names", "email", "role"] },
        {
          model: db.MembershipMissedShareComments,
          as: "comments",
          include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
          separate: true,
          order: [["created_at", "ASC"]],
        },
      ],
    });
  }

  const json = row.toJSON ? row.toJSON() : row;
  const isRecipient = Number(row.shared_to) === Number(req.user.id);
  return ok(res, {
    ...json,
    link_path: json.link_path || membershipMissedShareLink(json.id),
    items: json.snapshot?.items || [],
    summary: json.snapshot?.summary || { officers: 0, submitted: 0, missed: 0 },
    comments: json.comments || [],
    permissions: {
      can_comment: canAccessMissedShare(req.user, row),
      can_mark_seen: isRecipient && String(row.status || "").toUpperCase() !== "SEEN",
    },
  });
});

export const addMembershipMissedShareComment = asyncHandler(async (req, res) => {
  await ensureMissedSharesTable();
  const row = await db.MembershipMissedShares.findByPk(req.params.id);
  if (!row) return fail(res, "Shared missed list not found", 404);
  if (!canAccessMissedShare(req.user, row)) return fail(res, "Access denied", 403);

  const comment = String(req.body.comment || "").trim();
  if (!comment) return fail(res, "comment is required");

  const createdRow = await db.MembershipMissedShareComments.create({
    share_id: row.id,
    user_id: req.user.id,
    comment,
  });

  const notifyId = Number(row.shared_to) === Number(req.user.id)
    ? row.shared_by
    : row.shared_to;
  if (notifyId && Number(notifyId) !== Number(req.user.id)) {
    await createNotification({
      whatsapp: true,
      receiverId: notifyId,
      type: "membership_missed_share_comment",
      title: "New comment on shared missed list",
      message: `${req.user.names || "Someone"} commented: ${comment.slice(0, 120)}`,
      link: membershipMissedShareLink(row.id),
    });
  }

  const withUser = await db.MembershipMissedShareComments.findByPk(createdRow.id, {
    include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
  });
  return created(res, withUser, "Comment added");
});

export const markMembershipMissedShareSeen = asyncHandler(async (req, res) => {
  await ensureMissedSharesTable();
  const row = await db.MembershipMissedShares.findByPk(req.params.id);
  if (!row) return fail(res, "Shared missed list not found", 404);
  if (Number(row.shared_to) !== Number(req.user.id)) {
    return fail(res, "Only the recipient can mark this list as seen", 403);
  }

  const note = String(req.body.note || req.body.comment || "").trim();
  await row.update({
    status: "SEEN",
    seen_at: new Date(),
    opened_at: row.opened_at || new Date(),
  });

  if (note) {
    await db.MembershipMissedShareComments.create({
      share_id: row.id,
      user_id: req.user.id,
      comment: note,
    });
  }

  if (row.shared_by && Number(row.shared_by) !== Number(req.user.id)) {
    await createNotification({
      whatsapp: true,
      receiverId: row.shared_by,
      type: "membership_missed_share_seen",
      title: "Shared missed list marked as seen",
      message: note
        ? `${req.user.names || "ED"} marked the missed list as seen: ${note.slice(0, 120)}`
        : `${req.user.names || "ED"} marked the missed list as seen.`,
      link: membershipMissedShareLink(row.id),
    });
  }

  const refreshed = await loadMissedShare(row.id);
  const json = refreshed.toJSON ? refreshed.toJSON() : refreshed;
  return ok(res, {
    ...json,
    link_path: json.link_path || membershipMissedShareLink(json.id),
    items: json.snapshot?.items || [],
    summary: json.snapshot?.summary || { officers: 0, submitted: 0, missed: 0 },
    comments: json.comments || [],
    permissions: {
      can_comment: true,
      can_mark_seen: false,
    },
  }, "Marked as seen");
});

export const getMembershipReport = asyncHandler(async (req, res) => {
  const row = await loadReport(req.params.id);
  if (!row) return fail(res, "Membership report not found", 404);
  if (!(await canAccess(req.user, row))) return fail(res, "Access denied", 403);
  await db.MembershipReportViewers.findOrCreate({
    where: { report_id: row.id, user_id: req.user.id },
    defaults: { viewed_at: new Date() },
  });
  return ok(res, {
    ...row.toJSON(),
    permissions: reportPermissions(req.user, row),
  });
});

export const createMembershipReport = asyncHandler(async (req, res) => {
  if (!canCreateMembershipReportRole(req.user.role)) {
    return fail(res, "Only membership officers can create membership reports", 403);
  }
  const body = req.body || {};
  const report_type = String(body.report_type || "").toUpperCase();
  if (!REPORT_TYPES.includes(report_type)) return fail(res, "Valid report_type is required");
  if (!body.start_date || !body.end_date || !body.year) return fail(res, "start_date, end_date, and year are required");
  if (!String(body.comment || "").trim()) return fail(res, "Comment/Remarks is required");

  const row = await db.MembershipReports.create({
    report_type,
    start_date: body.start_date,
    end_date: body.end_date,
    year: body.year,
    month: body.month || null,
    quarter: body.quarter != null ? String(body.quarter) : null,
    week: body.week || null,
    user_id: req.user.id,
    location: body.location || null,
    title: body.title || null,
    comment: body.comment,
    monthly_month: body.monthly_month || null,
    yearly_year: body.yearly_year || null,
    status: "PENDING",
    submitted_by: req.user.id,
  });

  const items = Array.isArray(body.items) ? body.items : body.timber_items || [];
  if (items.length) {
    await db.MembershipReportItems.bulkCreate(
      items.map((item) => ({
        report_id: row.id,
        timber_name: item.timber_name || null,
        category: String(item.category || "NORMAL").toUpperCase(),
        number_of_timber: toNumber(item.number_of_timber),
        price: toNumber(item.price),
        total_cost: toNumber(item.total_cost),
        vat: toNumber(item.vat),
        msf: toNumber(item.msf),
        mst: toNumber(item.mst),
        vat_and_msf: toNumber(item.vat_and_msf),
        vat_and_mst: toNumber(item.vat_and_mst),
      }))
    );
  }

  const incomingPayments = Array.isArray(body.payments) ? body.payments : [];
  await db.MembershipReportPayments.bulkCreate(
    PAYMENT_METHODS.map((method) => {
      const found = incomingPayments.find((payment) => String(payment.method || "").toUpperCase() === method);
      return { report_id: row.id, method, amount: toNumber(found?.amount) };
    })
  );

  const customers = Array.isArray(body.customers) ? body.customers : [];
  if (customers.length) {
    await db.CustomersNoInvoice.bulkCreate(
      customers.map((customer) => ({
        report_id: row.id,
        name: customer.name || null,
        phone: customer.phone || null,
        amount: customer.amount || null,
      }))
    );
  }

  const reviewerIds = Array.isArray(body.reviewer_ids) ? body.reviewer_ids : [];
  if (reviewerIds.length) {
    await db.MembershipReportReviewers.bulkCreate(
      reviewerIds.map((reviewer_id) => ({
        report_id: row.id,
        reviewer_id,
        assigned_by: req.user.id,
        status: "PENDING",
      }))
    );
  }

  await addMrLog(row.id, "CREATED", req.user.id, `Report created successfully. Comment: ${String(body.comment).slice(0, 100)}`);
  await createLog(req.user.id, "create_membership_report", `Created membership report #${row.id}`);
  return created(res, await loadReport(row.id), "Membership report saved");
});

export const updateMembershipReport = asyncHandler(async (req, res) => {
  const row = await db.MembershipReports.findByPk(req.params.id);
  if (!row) return fail(res, "Membership report not found", 404);
  if (Number(row.submitted_by) !== Number(req.user.id) && !canManage(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  if (row.status !== "REVERTED" && !canManage(req.user.role)) {
    return fail(res, "Only reverted reports can be edited");
  }
  const body = req.body || {};
  await row.update({
    title: body.title !== undefined ? body.title : row.title,
    comment: body.comment !== undefined ? body.comment : row.comment,
    location: body.location !== undefined ? body.location : row.location,
    start_date: body.start_date || row.start_date,
    end_date: body.end_date || row.end_date,
    status: "PENDING",
  });
  await addMrLog(row.id, "UPDATED", req.user.id, body.comment || "Report updated and resubmitted");
  return ok(res, await loadReport(row.id), "Membership report updated");
});

export const approveMembershipReport = asyncHandler(async (req, res) => {
  const row = await db.MembershipReports.findByPk(req.params.id);
  if (!row) return fail(res, "Membership report not found", 404);
  if (!canApprove(req.user.role)) return fail(res, "Only Accountants can approve membership reports", 403);
  await row.update({
    status: "APPROVED",
    approved_by: req.user.id,
    approved_at: new Date(),
  });
  await addMrLog(row.id, "APPROVED", req.user.id, req.body.comment || "Report approved");
  if (row.submitted_by) {
    const loaded = await loadReport(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: row.submitted_by,
      type: "membership_report_status",
      title: `Membership report #${row.id} approved`,
      message: req.body.comment || "Your membership report was approved.",
      link: membershipReportLink(row.id),
      emailPayload: buildEmailPayload("membership_report", loaded, {
        intro: "Your membership report has been approved by the accounts team.",
        actor: req.user,
        note: req.body.comment,
      }),
    });
  }
  return ok(res, await loadReport(row.id), "Membership report approved");
});

export const revertMembershipReport = asyncHandler(async (req, res) => {
  const row = await db.MembershipReports.findByPk(req.params.id);
  if (!row) return fail(res, "Membership report not found", 404);
  if (!canApprove(req.user.role)) return fail(res, "Only Accountants can revert membership reports", 403);
  const comment = String(req.body.comment || "").trim();
  if (!comment) return fail(res, "A comment is required when reverting");
  await row.update({ status: "REVERTED", approved_by: null, approved_at: null });
  await addMrLog(row.id, "REVERTED", req.user.id, comment);
  if (row.submitted_by) {
    const loaded = await loadReport(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: row.submitted_by,
      type: "membership_report_status",
      title: `Membership report #${row.id} reverted`,
      message: comment,
      link: membershipReportLink(row.id),
      emailPayload: buildEmailPayload("membership_report", loaded, {
        intro: "Your membership report was reverted and requires corrections before it can proceed.",
        actor: req.user,
        note: comment,
        actionRequired: "Please review the comment, update your report, and resubmit.",
      }),
    });
  }
  return ok(res, await loadReport(row.id), "Membership report reverted");
});

export const addMembershipReportComment = asyncHandler(async (req, res) => {
  const row = await db.MembershipReports.findByPk(req.params.id);
  if (!row) return fail(res, "Membership report not found", 404);
  if (!(await canAccess(req.user, row))) return fail(res, "Access denied", 403);
  const comment = String(req.body.comment || "").trim();
  if (!comment) return fail(res, "comment is required");
  const createdRow = await db.MembershipReportComments.create({
    report_id: row.id,
    user_id: req.user.id,
    comment,
  });
  return created(res, createdRow, "Comment added");
});

export const assignMembershipReportReviewer = asyncHandler(async (req, res) => {
  const row = await db.MembershipReports.findByPk(req.params.id);
  if (!row) return fail(res, "Membership report not found", 404);
  if (!canAssignReviewers(req.user.role)) return fail(res, "You don't have permission to assign reviewers", 403);
  const reviewerIds = Array.isArray(req.body.reviewer_ids)
    ? req.body.reviewer_ids
    : req.body.reviewer_id
      ? [req.body.reviewer_id]
      : [];
  const reason = String(req.body.reason || req.body.assign_reason || "").trim();
  if (!reviewerIds.length) return fail(res, "reviewer_id is required");
  if (!reason) return fail(res, "Assignment reason is required");
  const priority = requireNotificationPriority(req.body);
  if (!priority) return fail(res, "Select notification priority (Send as: Urgent / High / Middle / Low)");

  for (const reviewer_id of reviewerIds) {
    const existing = await db.MembershipReportReviewers.findOne({
      where: { report_id: row.id, reviewer_id },
    });
    if (existing) continue;
    const reviewer = await db.Users.findByPk(reviewer_id, { attributes: ["id", "names", "role", "email"] });
    if (!reviewer) continue;
    await db.MembershipReportReviewers.create({
      report_id: row.id,
      reviewer_id,
      assigned_by: req.user.id,
      status: "PENDING",
      assigned_at: new Date(),
    });
    await addMrLog(
      row.id,
      "ASSIGNED",
      req.user.id,
      `Shared with: ${reviewer.names || "Unknown User"} (${reviewer.role || "staff"}, ID: ${reviewer_id})\nReason: ${reason}`
    );
    const loaded = await loadReport(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: reviewer_id,
      type: "membership_report_assigned",
      title: `Membership report #${row.id} shared with you`,
      message: reason || `${req.user.names} shared membership report #${row.id} with you.`,
      link: membershipReportLink(row.id),
      priority,
      emailPayload: buildEmailPayload("membership_report", loaded, {
        intro: `${req.user.names} shared membership report #${row.id} with you.`,
        actor: req.user,
        note: reason,
        actionRequired: "Open the report from Shared with Me (or this notification) to review it.",
      }),
    });
  }
  return ok(res, await loadReport(row.id), "Report shared successfully");
});

export const markMembershipReportReviewed = asyncHandler(async (req, res) => {
  const row = await db.MembershipReports.findByPk(req.params.id);
  if (!row) return fail(res, "Membership report not found", 404);
  const reviewer = await db.MembershipReportReviewers.findOne({
    where: { report_id: row.id, reviewer_id: req.user.id },
  });
  if (!reviewer) return fail(res, "You are not assigned as a reviewer for this report", 403);
  const comment = String(req.body.comment || "").trim();
  await reviewer.update({ status: "REVIEWED" });
  await addMrLog(
    row.id,
    "REVIEWED",
    req.user.id,
    `Report marked as reviewed by ${req.user.names || "User"}${comment ? `: ${comment}` : ""}`
  );
  return ok(res, await loadReport(row.id), "Report marked as reviewed successfully");
});

export const removeMembershipReportReviewer = asyncHandler(async (req, res) => {
  const row = await db.MembershipReports.findByPk(req.params.id);
  if (!row) return fail(res, "Membership report not found", 404);
  if (!canAssignReviewers(req.user.role)) return fail(res, "Only authorized staff can remove shared users", 403);
  const reviewer_id = req.body.reviewer_id || req.params.reviewerId;
  const assigned = await db.MembershipReportReviewers.findOne({
    where: { report_id: row.id, reviewer_id },
  });
  if (!assigned) return fail(res, "Reviewer assignment not found", 404);
  const reviewer = await db.Users.findByPk(reviewer_id, { attributes: ["id", "names"] });
  await assigned.destroy();
  await addMrLog(row.id, "REMOVED", req.user.id, `Removed reviewer: ${reviewer?.names || reviewer_id}`);
  return ok(res, await loadReport(row.id), "Reviewer removed");
});
