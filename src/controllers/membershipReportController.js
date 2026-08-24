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
import { buildMembershipAnalytics } from "../services/membershipAnalyticsService.js";

const USER_ATTR = { attributes: USER_PUBLIC };
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
    can_assign: canApprove(user.role),
    can_remove_reviewer: canApprove(user.role),
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
  return (
    canManage(role) ||
    isExactHr(role) ||
    canReviewWorkflow(role) ||
    value.includes("membership")
  );
}

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

export const getMembershipReportCoverage = asyncHandler(async (req, res) => {
  if (!canManage(req.user.role)) return fail(res, "Access denied", 403);

  const reportType = String(req.query.report_type || "").trim().toUpperCase();
  if (!REPORT_TYPES.includes(reportType)) {
    return fail(res, "Select a report type to see who missed reporting");
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
  applyReportFilters(reportWhere, { ...req.query, search: "", status: "" });
  const reports = await db.MembershipReports.findAll({
    where: reportWhere,
    order: [["created_at", "DESC"]],
  });

  const latestByUser = new Map();
  reports.forEach((report) => {
    const userId = Number(report.user_id);
    if (!latestByUser.has(userId)) latestByUser.set(userId, report);
  });

  const selectedUser = req.query.user_id;
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

  return ok(res, {
    items,
    summary: {
      officers: items.length,
      submitted: items.filter((item) => item.submitted).length,
      missed: items.filter((item) => item.missed).length,
    },
  });
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
      link: `/membership-reports/${row.id}`,
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
      link: `/membership-reports/${row.id}`,
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
  if (!canApprove(req.user.role)) return fail(res, "You don't have permission to assign reviewers", 403);
  const reviewerIds = Array.isArray(req.body.reviewer_ids)
    ? req.body.reviewer_ids
    : req.body.reviewer_id
      ? [req.body.reviewer_id]
      : [];
  const reason = String(req.body.reason || req.body.assign_reason || "").trim();
  if (!reviewerIds.length) return fail(res, "reviewer_id is required");
  if (!reason) return fail(res, "Assignment reason is required");

  for (const reviewer_id of reviewerIds) {
    const existing = await db.MembershipReportReviewers.findOne({
      where: { report_id: row.id, reviewer_id },
    });
    if (existing) continue;
    const reviewer = await db.Users.findByPk(reviewer_id, { attributes: ["id", "names"] });
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
      `Assigned reviewer: ${reviewer?.names || "Unknown User"} (ID: ${reviewer_id})\nReason: ${reason}`
    );
    const loaded = await loadReport(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: reviewer_id,
      type: "membership_report_assigned",
      title: `Assigned to membership report #${row.id}`,
      message: reason,
      link: `/membership-reports/${row.id}`,
      emailPayload: buildEmailPayload("membership_report", loaded, {
        intro: `${req.user.names} has assigned you as a reviewer on membership report #${row.id}.`,
        actor: req.user,
        note: reason,
        actionRequired: "Please review the membership report and submit your review comments.",
      }),
    });
  }
  return ok(res, await loadReport(row.id), "Reviewer assigned successfully");
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
  if (!canApprove(req.user.role)) return fail(res, "Only Accountants are authorized to remove reviewers", 403);
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
