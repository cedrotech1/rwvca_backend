import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { USER_PUBLIC } from "../services/workflowUsers.js";
import {
  isAdminRole,
  isAccountantRole,
  isEdRole,
  isExactHr,
  isExecutiveRole,
  canReviewWorkflow,
} from "../utils/roleHelpers.js";
import { buildRequisitionAnalytics } from "../services/requisitionAnalyticsService.js";

const USER_ATTR = { attributes: USER_PUBLIC };
const TRANSITIONS = {
  draft: ["pending"],
  pending: ["verification_process", "approved", "rejected", "reverted"],
  verification_process: ["approved", "reverted", "rejected"],
  reverted: ["pending"],
  rejected: [],
  approved: [],
  authorized: [],
};

const detailInclude = [
  { model: db.Department, as: "department", attributes: ["id", "name"] },
  { model: db.Users, as: "preparer", ...USER_ATTR },
  { model: db.Users, as: "sendToUser", ...USER_ATTR },
  { model: db.Users, as: "verifier", ...USER_ATTR },
  { model: db.Users, as: "approver", ...USER_ATTR },
  { model: db.Users, as: "authorizer", ...USER_ATTR },
  { model: db.Requisitionitems, as: "requisitionitems_requisition_id" },
  {
    model: db.RequisitionLogs,
    as: "requisition_logs_requisition_id",
    include: [{ model: db.Users, as: "changedByUser", attributes: ["id", "names", "email", "role"] }],
  },
];

function financeReady(row, role) {
  const ready = ["approved", "authorized"].includes(String(row.status || "").toLowerCase());
  if (String(role || "").trim().toLowerCase() === "assistant to ed") {
    return ready && Number(row.total_amount_requested || 0) < 100000;
  }
  return ready;
}

function canAccess(user, row) {
  if (isAdminRole(user.role) || isExecutiveRole(user.role) || isExactHr(user.role)) return true;
  const id = Number(user.id);
  const own = [
    row.prepared_by,
    row.sended_to,
    row.submitted_by,
    row.viewer_id,
    row.verified_by,
    row.approved_by,
  ].some((value) => Number(value) === id);
  if (own) return true;
  if (isAccountantRole(user.role)) return financeReady(row, user.role);
  return false;
}

function sumItems(items) {
  return items.reduce((total, item) => total + Number(item.total_amount || (Number(item.quantity || 0) * Number(item.unit_price || 0))), 0);
}

function mapItems(items, requisitionId) {
  return items.map((item, index) => {
    const quantity = Number(item.quantity || 0);
    const unit_price = Number(item.unit_price || 0);
    return {
      requisition_id: requisitionId,
      sn: Number(item.sn || index + 1),
      description: item.description || null,
      quantity,
      unit_price,
      total_amount: Number(item.total_amount || quantity * unit_price),
    };
  });
}

async function addReqLog(requisitionId, status, userId, comment) {
  await db.RequisitionLogs.create({
    requisition_id: requisitionId,
    status,
    changed_by: userId,
    comment: comment || null,
  });
}

async function loadRequisition(id) {
  return db.Requisitions.findByPk(id, {
    include: detailInclude,
    order: [[{ model: db.RequisitionLogs, as: "requisition_logs_requisition_id" }, "id", "ASC"]],
  });
}

export const getRequisitionAnalytics = asyncHandler(async (req, res) => {
  const canOrg = canReviewWorkflow(req.user.role) || isAccountantRole(req.user.role);
  if (!canOrg && String(req.query.scope) === "org") return fail(res, "Access denied", 403);
  const query = { ...req.query };
  if (!canOrg) query.user_id = req.user.id;
  return ok(res, await buildRequisitionAnalytics(query));
});

export const getRequisitions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const tab = req.query.tab || "my";
  const search = String(req.query.search || "").trim();
  const where = {};

  if (tab === "received") {
    where.sended_to = req.user.id;
  } else if (String(tab).startsWith("finance")) {
    if (!isAccountantRole(req.user.role) && !isAdminRole(req.user.role) && !isExecutiveRole(req.user.role)) {
      return fail(res, "Access denied", 403);
    }
    where.status = { [Op.in]: ["approved", "authorized"] };
    if (String(req.user.role || "").trim().toLowerCase() === "assistant to ed") {
      where.total_amount_requested = { [Op.lt]: 100000 };
    }
    if (tab === "finance_pending") where.finance_status = { [Op.iLike]: "pending" };
    if (tab === "finance_paid") where.finance_status = { [Op.iLike]: "paid" };
    if (tab === "finance_rejected") where.finance_status = { [Op.iLike]: "%reject%" };
  } else if (tab === "all" && (isAdminRole(req.user.role) || isExactHr(req.user.role) || isExecutiveRole(req.user.role))) {
    // organization-wide list for HR / ED / admin only
  } else {
    where[Op.or] = [{ prepared_by: req.user.id }, { submitted_by: req.user.id }];
  }

  if (req.query.status) where.status = req.query.status;
  if (req.query.department_id) where.department_id = req.query.department_id;
  if (req.query.date_from) {
    where.created_at = { ...(where.created_at || {}), [Op.gte]: `${req.query.date_from} 00:00:00` };
  }
  if (req.query.date_to) {
    where.created_at = { ...(where.created_at || {}), [Op.lte]: `${req.query.date_to} 23:59:59` };
  }
  if (search) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { account_code: { [Op.iLike]: `%${search}%` } },
          { budget_source: { [Op.iLike]: `%${search}%` } },
          { amount_in_words: { [Op.iLike]: `%${search}%` } },
        ],
      },
    ];
  }

  const { rows, count } = await db.Requisitions.findAndCountAll({
    where,
    include: [
      { model: db.Department, as: "department", attributes: ["id", "name"] },
      { model: db.Users, as: "preparer", attributes: ["id", "names", "email", "role"] },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getRequisition = asyncHandler(async (req, res) => {
  const row = await loadRequisition(req.params.id);
  if (!row) return fail(res, "Requisition not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  return ok(res, {
    ...row.toJSON(),
    permissions: {
      can_edit: Number(row.prepared_by) === Number(req.user.id) && ["draft", "reverted", "pending"].includes(row.status),
      can_submit: Number(row.prepared_by) === Number(req.user.id) && ["draft", "reverted"].includes(row.status),
      can_verify: Number(row.sended_to) === Number(req.user.id) || isAdminRole(req.user.role) || isExactHr(req.user.role),
      can_approve: isEdRole(req.user.role) || isExecutiveRole(req.user.role) || isAdminRole(req.user.role),
      can_reject: Number(row.sended_to) === Number(req.user.id) || isEdRole(req.user.role) || isAdminRole(req.user.role) || isExactHr(req.user.role),
      can_revert: Number(row.sended_to) === Number(req.user.id) || isEdRole(req.user.role) || isAdminRole(req.user.role) || isExactHr(req.user.role),
      can_authorize: isEdRole(req.user.role) && !row.authorized_by,
      can_finance: isAccountantRole(req.user.role) && financeReady(row, req.user.role),
    },
  });
});

export const createRequisition = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!body.date || !body.department_id || !body.budget_source || !body.account_code) {
    return fail(res, "date, department_id, budget_source, and account_code are required");
  }
  if (!items.length) return fail(res, "At least one requisition item is required");

  const action = body.action === "draft" ? "draft" : "pending";
  const sended_to = Number(body.sended_to || 0);
  if (action === "pending" && !sended_to) return fail(res, "sended_to is required when submitting");

  const total = sumItems(items);
  const row = await db.Requisitions.create({
    date: body.date,
    department_id: body.department_id,
    budget_source: body.budget_source,
    account_code: body.account_code,
    amount_in_words: body.amount_in_words || null,
    total_amount_requested: total,
    prepared_by: req.user.id,
    sended_to: sended_to || 0,
    submitted_by: action === "pending" ? req.user.id : null,
    submitted_at: action === "pending" ? new Date() : null,
    viewer_id: body.viewer_id || null,
    status: action,
  });
  await db.Requisitionitems.bulkCreate(mapItems(items, row.id));
  await addReqLog(row.id, action, req.user.id, action === "draft" ? "Saved as draft" : "Submitted for review");
  await createLog(req.user.id, "create_requisition", `Created requisition #${row.id}`);

  if (action === "pending" && sended_to) {
    const loaded = await loadRequisition(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: sended_to,
      type: "requisition_pending",
      title: `Requisition #${row.id} submitted for verification`,
      message: `${req.user.names} submitted a requisition of ${total}.`,
      link: `/requisitions/${row.id}`,
      emailPayload: buildEmailPayload("requisition", loaded, {
        intro: `${req.user.names} has submitted a requisition that requires your verification.`,
        actor: req.user,
        actionRequired: "Please review the requisition details below and verify or return it for corrections.",
      }),
    });
  }
  return created(res, await loadRequisition(row.id), action === "draft" ? "Draft saved" : "Requisition submitted");
});

export const updateRequisition = asyncHandler(async (req, res) => {
  const row = await db.Requisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Requisition not found", 404);
  if (Number(row.prepared_by) !== Number(req.user.id)) return fail(res, "Access denied", 403);
  if (!["draft", "reverted", "pending"].includes(row.status)) {
    return fail(res, `Cannot edit requisition with status ${row.status}`);
  }

  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : null;
  const action = body.action === "submit" ? "pending" : row.status === "reverted" && body.action === "submit" ? "pending" : row.status;
  const sended_to = Number(body.sended_to || row.sended_to || 0);
  if (action === "pending" && !sended_to) return fail(res, "sended_to is required when submitting");

  const payload = {
    date: body.date || row.date,
    department_id: body.department_id || row.department_id,
    budget_source: body.budget_source || row.budget_source,
    account_code: body.account_code || row.account_code,
    amount_in_words: body.amount_in_words !== undefined ? body.amount_in_words : row.amount_in_words,
    sended_to,
    viewer_id: body.viewer_id !== undefined ? body.viewer_id : row.viewer_id,
    status: body.action === "submit" ? "pending" : row.status === "reverted" && body.action === "submit" ? "pending" : row.status,
  };
  if (items) {
    payload.total_amount_requested = sumItems(items);
    await db.Requisitionitems.destroy({ where: { requisition_id: row.id } });
    await db.Requisitionitems.bulkCreate(mapItems(items, row.id));
  }
  if (body.action === "submit") {
    payload.submitted_by = req.user.id;
    payload.submitted_at = new Date();
  }
  await row.update(payload);
  await addReqLog(row.id, row.status, req.user.id, body.action === "submit" ? "Resubmitted for review" : "Requisition updated");
  return ok(res, await loadRequisition(row.id), "Requisition updated");
});

export const updateRequisitionStatus = asyncHandler(async (req, res) => {
  const row = await db.Requisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Requisition not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);

  const status = String(req.body.status || "").trim();
  const comment = String(req.body.comment || "").trim();
  const reason = String(req.body.reason || comment || "").trim();
  const allowed = TRANSITIONS[row.status] || [];
  if (!allowed.includes(status)) {
    return fail(res, `Invalid status transition from ${row.status} to ${status}`);
  }

  const patch = { status };
  if (status === "pending") {
    patch.submitted_by = req.user.id;
    patch.submitted_at = new Date();
  } else if (status === "verification_process") {
    patch.verified_by = req.user.id;
    patch.verified_at = new Date();
    patch.verification_comment = comment || null;
  } else if (status === "approved") {
    patch.approved_by = req.user.id;
    patch.approved_at = new Date();
    patch.approval_comment = comment || null;
  } else if (status === "rejected") {
    patch.rejected_by = req.user.id;
    patch.rejected_at = new Date();
    patch.rejection_reason = reason || null;
  } else if (status === "reverted") {
    patch.reverted_by = req.user.id;
    patch.reverted_at = new Date();
    patch.reversion_reason = reason || null;
  }
  if (comment) patch.comment = comment;
  await row.update(patch);
  await addReqLog(row.id, status, req.user.id, comment || reason || `Status changed to ${status}`);
  await createLog(req.user.id, `requisition_status_${status}`, `Requisition #${row.id} status changed to ${status}`);

  const loaded = await loadRequisition(row.id);
  const notifyId = status === "pending" ? row.sended_to : row.prepared_by;
  const statusLabel = status.replace(/_/g, " ");
  const needsAction = ["pending", "verification_process"].includes(status);
  await createNotification({
      whatsapp: true,
    receiverId: notifyId,
    type: `requisition_${status}`,
    title: `Requisition #${row.id} ${statusLabel}`,
    message: reason || comment || `Requisition #${row.id} is now ${statusLabel}.`,
    link: `/requisitions/${row.id}`,
    emailPayload: buildEmailPayload("requisition", loaded, {
      intro: needsAction
        ? `Requisition #${row.id} requires your attention — status is now "${statusLabel}".`
        : `Requisition #${row.id} has been updated to "${statusLabel}".`,
      actor: req.user,
      note: reason || comment,
      actionRequired: needsAction ? "Please review the requisition and take the appropriate next action." : undefined,
    }),
  });
  return ok(res, loaded, "Requisition status updated");
});

export const authorizeRequisition = asyncHandler(async (req, res) => {
  const row = await db.Requisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Requisition not found", 404);
  if (!isEdRole(req.user.role)) return fail(res, "Only the Executive Director can authorize", 403);
  if (row.authorized_by) return fail(res, "This requisition is already authorized");

  await row.update({
    authorized_by: req.user.id,
    authorized_at: new Date(),
    ed_signature_and_stamp: req.body.ed_signature_and_stamp
      ? String(req.body.ed_signature_and_stamp)
      : row.ed_signature_and_stamp,
  });
  await addReqLog(row.id, "authorized", req.user.id, "Authorized by Executive Director");
  if (row.prepared_by) {
    const loaded = await loadRequisition(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: row.prepared_by,
      type: "requisition_authorized",
      title: `Requisition #${row.id} authorized`,
      message: "The Executive Director authorized this requisition.",
      link: `/requisitions/${row.id}`,
      emailPayload: buildEmailPayload("requisition", loaded, {
        intro: "Your requisition has been authorized by the Executive Director and may proceed to finance processing.",
        actor: req.user,
      }),
    });
  }
  return ok(res, await loadRequisition(row.id), "Requisition authorized");
});

export const updateViewerStatus = asyncHandler(async (req, res) => {
  const row = await db.Requisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Requisition not found", 404);
  if (Number(row.viewer_id) !== Number(req.user.id) && !isAdminRole(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  await row.update({
    viewer_status: req.body.viewer_status || "completed",
    viewer_comment: req.body.viewer_comment || row.viewer_comment,
    viewed_at: new Date(),
  });
  return ok(res, await loadRequisition(row.id), "Viewer status updated");
});

export const updateFinanceStatus = asyncHandler(async (req, res) => {
  const row = await db.Requisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Requisition not found", 404);
  if (!isAccountantRole(req.user.role) && !isAdminRole(req.user.role) && !isExecutiveRole(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  if (isAccountantRole(req.user.role) && !financeReady(row, req.user.role)) {
    return fail(res, "This requisition is not ready for finance", 403);
  }
  await row.update({ finance_status: req.body.finance_status || row.finance_status });
  await addReqLog(row.id, `finance_${req.body.finance_status || row.finance_status}`, req.user.id, req.body.comment || "Finance status updated");
  return ok(res, await loadRequisition(row.id), "Finance status updated");
});
