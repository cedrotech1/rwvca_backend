import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { requireNotificationPriority } from "../utils/notificationPriority.js";
import { getApproverForApplicant, hasSignature, normalizeEdStampChoice, USER_PUBLIC } from "../services/workflowUsers.js";
import {
  isAdminRole,
  isDirectApplicant,
  isEdRole,
  isExactHr,
  isExecutiveRole,
  canReviewWorkflow,
} from "../utils/roleHelpers.js";
import fileStorage from "../utils/fileStorage.js";
import { getLeaveBalance, getLeaveBalancesMap } from "../services/leaveBalanceService.js";
import { buildLeaveAnalytics } from "../services/leaveAnalyticsService.js";
import {
  assertLeaveScheduleCoverage,
  findCoveringLeaveSchedule,
  scheduleCoverageMessage,
} from "../utils/leaveScheduleGuard.js";
const { saveRequestFile } = fileStorage;

const USER_ATTR = { attributes: USER_PUBLIC };
const ALLOWED_LEAVE_TYPES = ["Annual", "Maternity", "Paternity", "Sick", "Compassionate", "Others"];
const detailInclude = [
  { model: db.Users, as: "user", ...USER_ATTR, include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }] },
  { model: db.Users, as: "hr", ...USER_ATTR },
  { model: db.Users, as: "executive", ...USER_ATTR },
  {
    model: db.LeaveRequestLogs,
    as: "logs",
    include: [{ model: db.Users, as: "changedByUser", attributes: ["id", "names", "email", "role"] }],
  },
];

function applicantRole(row) {
  return row.user?.role || "";
}

function isSpecialCase(row) {
  return isDirectApplicant(applicantRole(row));
}

function canAccessLeave(user, row) {
  if (isAdminRole(user.role) || isExecutiveRole(user.role)) return true;
  if (row.user_id === user.id) return true;
  if (isExactHr(user.role)) return !isSpecialCase(row);
  return false;
}

function isDesignatedApprover(user, row) {
  return isExecutiveRole(user.role) && Number(row.executive_id) === Number(user.id);
}

function allowApprove(row) {
  return (
    row.leave_requests_status === "verified_by_hr" ||
    (isSpecialCase(row) && row.leave_requests_status === "pending")
  );
}

async function addLeaveLog(requestId, status, userId, comment) {
  await db.LeaveRequestLogs.create({
    request_id: requestId,
    status,
    changed_by: userId,
    comment: comment || null,
  });
}

async function loadLeave(id) {
  return db.LeaveRequests.findByPk(id, {
    include: detailInclude,
    order: [[{ model: db.LeaveRequestLogs, as: "logs" }, "id", "ASC"]],
  });
}

export { getLeaveBalance } from "../services/leaveBalanceService.js";

export const getMyLeaveBalance = asyncHandler(async (req, res) => {
  const userId = req.query.user_id && canReviewWorkflow(req.user.role)
    ? Number(req.query.user_id)
    : req.user.id;
  return ok(res, await getLeaveBalance(userId));
});

export const checkLeaveSchedule = asyncHandler(async (req, res) => {
  const userId = req.query.user_id && canReviewWorkflow(req.user.role)
    ? Number(req.query.user_id)
    : req.user.id;
  const leave_from = req.query.leave_from;
  const return_date = req.query.return_date;
  if (!leave_from || !return_date) return fail(res, "leave_from and return_date are required");
  const schedule = await findCoveringLeaveSchedule(userId, leave_from, return_date);
  return ok(res, {
    covered: Boolean(schedule),
    schedule: schedule ? schedule.toJSON() : null,
    message: schedule
      ? scheduleCoverageMessage(schedule)
      : "No pre-scheduled leave covers these dates. Submit a leave schedule first.",
  });
});

export const getLeaveAnalytics = asyncHandler(async (req, res) => {
  if (!isExactHr(req.user.role) && !isAdminRole(req.user.role) && !isExecutiveRole(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  const data = await buildLeaveAnalytics(req.query);
  return ok(res, data);
});

export const getLeaveRequests = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const tab = req.query.tab || "my";
  const search = String(req.query.search || "").trim();
  const where = {};

  if (tab === "received") {
    if (!canReviewWorkflow(req.user.role)) return fail(res, "Access denied", 403);
    if (isExactHr(req.user.role) || isAdminRole(req.user.role)) {
      where.user_id = { [Op.ne]: req.user.id };
    } else if (isExecutiveRole(req.user.role)) {
      const counterpart = isEdRole(req.user.role) ? "Chairman" : "ED";
      where[Op.or] = [
        { hr_verification_status: "verified", leave_requests_status: "verified_by_hr" },
        { leave_requests_status: "approved" },
        {
          leave_requests_status: "pending",
          hr_id: { [Op.or]: [null, 0] },
          "$user.role$": counterpart,
        },
      ];
    }
  } else if (!isExactHr(req.user.role) && !isAdminRole(req.user.role)) {
    where.user_id = req.user.id;
  }

  if (req.query.status) where.leave_requests_status = req.query.status;
  if (req.query.leave_type) where.leave_type = req.query.leave_type;
  if (req.query.user_id && (tab === "received" || canReviewWorkflow(req.user.role))) {
    where.user_id = req.query.user_id;
  }
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
          { leave_type: { [Op.iLike]: `%${search}%` } },
          { "$user.names$": { [Op.iLike]: `%${search}%` } },
        ],
      },
    ];
  }

  const { rows, count } = await db.LeaveRequests.findAndCountAll({
    where,
    include: [{ model: db.Users, as: "user", ...USER_ATTR }],
    order: [["id", "DESC"]],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  });

  let items = rows.map((row) => row.toJSON());
  if (req.query.include_balance === "1" && canReviewWorkflow(req.user.role)) {
    const balanceMap = await getLeaveBalancesMap(items.map((row) => row.user_id));
    items = items.map((row) => ({
      ...row,
      user_balance: balanceMap[row.user_id] || null,
      days_left: balanceMap[row.user_id]?.total_available_days ?? null,
    }));
  }

  return ok(res, { items, pagination: paginationMeta(count, page, limit) });
});

export const getLeaveRequest = asyncHandler(async (req, res) => {
  const row = await loadLeave(req.params.id);
  if (!row) return fail(res, "Leave request not found", 404);
  if (!canAccessLeave(req.user, row)) return fail(res, "Access denied", 403);
  const balance = await getLeaveBalance(row.user_id);
  return ok(res, {
    ...row.toJSON(),
    balance,
    permissions: {
      can_edit: row.user_id === req.user.id && row.leave_requests_status === "reverted",
      can_hr_act: isExactHr(req.user.role) && !isSpecialCase(row),
      can_approve: isDesignatedApprover(req.user, row) && allowApprove(row),
      can_reject: isDesignatedApprover(req.user, row) && allowApprove(row),
      is_special_case: isSpecialCase(row),
    },
  });
});

export const createLeaveRequest = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const leave_type = body.leave_type;
  const leave_from = body.leave_from;
  const return_date = body.return_date;
  const requested_days = Number(body.requested_days);
  const year = Number(body.year || (leave_from ? new Date(leave_from).getFullYear() : 0));

  if (!leave_type || !ALLOWED_LEAVE_TYPES.includes(leave_type)) {
    return fail(res, `leave_type must be one of: ${ALLOWED_LEAVE_TYPES.join(", ")}`);
  }
  if (!leave_from || !return_date || !requested_days || !year) {
    return fail(res, "leave_type, year, leave_from, return_date, and requested_days are required");
  }
  if (new Date(leave_from) > new Date(return_date)) {
    return fail(res, "Return date must be after start date");
  }
  if (requested_days < 1) return fail(res, "Requested days must be at least 1");

  let letterSaved = null;
  try {
    letterSaved = saveRequestFile(req, "leave_letters", {
      prefix: "leave",
      fieldNames: ["supporting_letter", "letter", "file"],
    });
  } catch (error) {
    return fail(res, error.message);
  }
  if (!letterSaved?.dbPath && !body.letter_url) {
    return fail(res, "Supporting letter / document is required");
  }

  try {
    await assertLeaveScheduleCoverage(req.user.id, leave_from, return_date);
  } catch (error) {
    return fail(res, error.message, error.statusCode || 400);
  }

  const balance = await getLeaveBalance(req.user.id);
  if (requested_days > balance.total_available_days) {
    return fail(
      res,
      `Requested days (${requested_days}) exceed your available leave balance (${balance.total_available_days} days).`
    );
  }

  const officers = await getApproverForApplicant(req.user.role);
  if (!officers.executive) return fail(res, "Executive Director account not found. Cannot proceed.");
  if (!officers.direct && !officers.hr) return fail(res, "HR account not found. Cannot proceed.");

  const from_carry_over = Math.min(requested_days, balance.carry_over_remaining);
  const from_current = requested_days - from_carry_over;

  const row = await db.LeaveRequests.create({
    leave_type,
    user_id: req.user.id,
    year,
    leave_from,
    return_date,
    requested_days,
    hr_id: officers.hr?.id || null,
    executive_id: officers.executive.id,
    chairman_id: officers.chairman?.id || null,
    leave_requests_status: "pending",
    letter_url: letterSaved?.dbPath || body.letter_url || null,
    carry_over_days_used: from_carry_over,
    current_year_days_used: from_current,
    carry_over_year: from_carry_over > 0 ? balance.previous_year : null,
    current_year_val: balance.current_year,
    applicant_signature: req.user.signature_url || null,
  });

  await addLeaveLog(
    row.id,
    "pending",
    req.user.id,
    officers.direct
      ? `Leave request submitted (direct ED/Chairman approval) - Using ${from_carry_over} carry-over and ${from_current} current-year days`
      : `Leave request submitted by employee - Using ${from_carry_over} carry-over and ${from_current} current-year days`
  );
  await createLog(req.user.id, "create_leave_request", `Created leave request #${row.id}`);

  const link = `/leave-requests/${row.id}`;
  const priority = requireNotificationPriority(req.body) || "middle";
  if (officers.direct) {
    await createNotification({
      whatsapp: true,
      receiverId: officers.executive.id,
      type: "leave_request",
      title: `Leave Request #${row.id} – Your Approval Required`,
      message: `${req.user.names} submitted a ${leave_type} leave request for ${requested_days} day(s).`,
      link,
      priority,
      emailPayload: buildEmailPayload("leave", row, {
        intro: `${req.user.names} submitted a ${leave_type} leave request that requires your direct approval.`,
        actor: req.user,
        actionRequired: "Please review the leave details below and approve or reject this request.",
      }),
    });
  } else {
    await createNotification({
      whatsapp: true,
      receiverId: officers.hr.id,
      type: "leave_request",
      title: `New Leave Request #${row.id}`,
      message: `${req.user.names} submitted a ${leave_type} leave request for ${requested_days} day(s).`,
      link,
      priority,
      emailPayload: buildEmailPayload("leave", row, {
        intro: `${req.user.names} submitted a new ${leave_type} leave request for HR verification.`,
        actor: req.user,
        actionRequired: "Please verify the leave details and forward the request for executive approval.",
      }),
    });
  }

  return created(res, await loadLeave(row.id), "Leave request created");
});

export const updateLeaveRequest = asyncHandler(async (req, res) => {
  const row = await loadLeave(req.params.id);
  if (!row) return fail(res, "Leave request not found", 404);
  if (row.user_id !== req.user.id || row.leave_requests_status !== "reverted") {
    return fail(res, "You can only edit a reverted leave request", 403);
  }

  const leave_from = req.body.leave_from || row.leave_from;
  const return_date = req.body.return_date || row.return_date;
  const requested_days = Number(req.body.requested_days || row.requested_days);
  const leave_type = req.body.leave_type || row.leave_type;
  if (!ALLOWED_LEAVE_TYPES.includes(leave_type)) {
    return fail(res, `leave_type must be one of: ${ALLOWED_LEAVE_TYPES.join(", ")}`);
  }

  try {
    await assertLeaveScheduleCoverage(req.user.id, leave_from, return_date);
  } catch (error) {
    return fail(res, error.message, error.statusCode || 400);
  }

  const balance = await getLeaveBalance(req.user.id);
  const available = balance.total_available_days + Number(row.requested_days || 0);
  if (requested_days > available) {
    return fail(res, `Requested days exceed your available leave balance (${available} days).`);
  }

  const from_carry_over = Math.min(requested_days, balance.carry_over_remaining + Number(row.carry_over_days_used || 0));
  const from_current = requested_days - Math.min(requested_days, from_carry_over);

  await row.update({
    leave_type,
    leave_from,
    return_date,
    requested_days,
    year: new Date(leave_from).getFullYear(),
    letter_url: req.body.letter_url !== undefined ? req.body.letter_url : row.letter_url,
    leave_requests_status: "pending",
    hr_verification_status: "pending",
    carry_over_days_used: from_carry_over,
    current_year_days_used: from_current,
  });
  await addLeaveLog(row.id, "pending", req.user.id, "Request edited after revert and resubmitted");
  if (row.hr_id) {
    await createNotification({
      whatsapp: true,
      receiverId: row.hr_id,
      type: "leave_request",
      title: `Leave Request #${row.id} resubmitted`,
      message: `${req.user.names} edited and resubmitted a leave request.`,
      link: `/leave-requests/${row.id}`,
      priority: requireNotificationPriority(req.body) || "middle",
      emailPayload: buildEmailPayload("leave", row, {
        intro: `${req.user.names} edited and resubmitted a leave request after it was reverted.`,
        actor: req.user,
        actionRequired: "Please review the updated leave request and verify it again.",
      }),
    });
  }
  return ok(res, await loadLeave(row.id), "Leave request updated");
});

export const deleteLeaveRequest = asyncHandler(async (req, res) => {
  const row = await loadLeave(req.params.id);
  if (!row) return fail(res, "Leave request not found", 404);
  const isOwner = Number(row.user_id) === Number(req.user.id);
  const isHrAdmin = isExactHr(req.user.role) || isAdminRole(req.user.role);
  if (!isOwner && !isHrAdmin) return fail(res, "You are not authorized to delete this request.", 403);
  if (isOwner && !isHrAdmin && !["pending", "draft"].includes(row.leave_requests_status)) {
    return fail(res, "Only pending requests can be deleted", 403);
  }
  await db.LeaveRequestLogs.destroy({ where: { request_id: row.id } });
  await row.destroy();
  await createLog(req.user.id, "delete_leave", `Deleted leave request #${req.params.id}`);
  return ok(res, null, "Leave request deleted");
});

export const verifyLeaveByHr = asyncHandler(async (req, res) => {
  const row = await loadLeave(req.params.id);
  if (!row) return fail(res, "Leave request not found", 404);
  if (!isExactHr(req.user.role) || isSpecialCase(row)) return fail(res, "Access denied", 403);
  if (row.leave_requests_status !== "pending") return fail(res, "Only pending requests can be verified");
  if (!hasSignature(req.user)) {
    return fail(res, "Please upload your signature in profile settings before verifying requests.");
  }

  const days_authorized = Number(req.body.days_authorized || row.requested_days);
  await row.update({
    days_authorized,
    hr_verification_status: "verified",
    hr_verified_at: new Date(),
    hr_signature: "yes",
    hr_id: row.hr_id || req.user.id,
    leave_requests_status: "verified_by_hr",
  });
  await addLeaveLog(row.id, "verified_by_hr", req.user.id, req.body.comment || "Verified by HR");

  const link = `/leave-requests/${row.id}`;
  const applicant = row.user?.names || "the applicant";
  await createNotification({
      whatsapp: true,
    receiverId: row.user_id,
    type: "leave_request",
    title: "Your Leave Request Has Been Verified by HR",
    message: `Your leave request #${row.id} has been verified and is now awaiting final approval.`,
    link,
      priority: requireNotificationPriority(req.body) || "middle",
    emailPayload: buildEmailPayload("leave", row, {
      intro: "HR has verified your leave request. It is now awaiting final approval from the Executive Director.",
      actor: req.user,
      note: req.body.comment,
    }),
  });
  if (row.executive_id) {
    await createNotification({
      whatsapp: true,
      receiverId: row.executive_id,
      type: "leave_request",
      title: "Leave Request Requires Your Approval",
      message: `HR verified a leave request by ${applicant}.`,
      link,
      priority: requireNotificationPriority(req.body) || "middle",
      emailPayload: buildEmailPayload("leave", row, {
        intro: `HR has verified the leave request submitted by ${applicant}. Your approval is now required.`,
        actor: req.user,
        note: req.body.comment,
        actionRequired: "Please review the leave details below and approve or reject this request.",
      }),
    });
  }
  return ok(res, await loadLeave(row.id), "Leave request verified by HR");
});

export const revertLeaveByHr = asyncHandler(async (req, res) => {
  const row = await loadLeave(req.params.id);
  if (!row) return fail(res, "Leave request not found", 404);
  if (!isExactHr(req.user.role) || isSpecialCase(row)) return fail(res, "Access denied", 403);
  if (!["pending", "verified_by_hr", "approved"].includes(row.leave_requests_status)) {
    return fail(res, "This request cannot be reverted");
  }

  const comment = String(req.body.comment || "").trim();
  if (!comment) return fail(res, "A comment is required when reverting a leave request");
  await row.update({
    leave_requests_status: "reverted",
    hr_verification_status: null,
    hr_verified_at: null,
    hr_signature: null,
  });
  await addLeaveLog(row.id, "reverted", req.user.id, comment || "Reverted by HR");
  await createNotification({
      whatsapp: true,
    receiverId: row.user_id,
    type: "leave_request",
    title: `Leave Request #${row.id} reverted`,
    message: comment || "Your leave request was reverted by HR. Please edit and resubmit.",
    link: `/leave-requests/${row.id}`,
      priority: requireNotificationPriority(req.body) || "middle",
    emailPayload: buildEmailPayload("leave", row, {
      intro: "Your leave request was reverted by HR and requires corrections before it can proceed.",
      actor: req.user,
      note: comment,
      actionRequired: "Please review the comment, update your request, and submit it again.",
    }),
  });
  return ok(res, await loadLeave(row.id), "Leave request reverted");
});

export const approveLeave = asyncHandler(async (req, res) => {
  const row = await loadLeave(req.params.id);
  if (!row) return fail(res, "Leave request not found", 404);
  if (!isDesignatedApprover(req.user, row) || !allowApprove(row)) {
    return fail(res, "You cannot approve this leave request", 403);
  }
  if (!hasSignature(req.user)) {
    return fail(res, "Please upload your signature in profile settings before approving requests.");
  }

  const days_authorized = row.days_authorized > 0 ? row.days_authorized : row.requested_days;
  await row.update({
    days_authorized,
    executive_verification_status: "verified",
    executive_approved_at: new Date(),
    executive_signature: "yes",
    ed_signature_and_stamp: normalizeEdStampChoice(req.body.ed_signature_and_stamp),
    leave_requests_status: "approved",
  });
  await addLeaveLog(row.id, "approved", req.user.id, req.body.comment || "Approved");
  await createLog(req.user.id, "approve_leave_request", `Approved leave request #${row.id}`);

  const link = `/leave-requests/${row.id}`;
  await createNotification({
      whatsapp: true,
    receiverId: row.user_id,
    type: "leave_request",
    title: "Your Leave Request Has Been Approved!",
    message: `Leave request #${row.id} is fully approved.`,
    link,
      priority: requireNotificationPriority(req.body) || "middle",
    emailPayload: buildEmailPayload("leave", row, {
      intro: "Your leave request has received final approval.",
      actor: req.user,
      note: req.body.comment,
    }),
  });
  if (!isSpecialCase(row) && row.hr_id) {
    await createNotification({
      whatsapp: true,
      receiverId: row.hr_id,
      type: "leave_request",
      title: "Leave Request Fully Approved",
      message: `Request #${row.id} has been approved.`,
      link,
      priority: requireNotificationPriority(req.body) || "middle",
      emailPayload: buildEmailPayload("leave", row, {
        intro: `Leave request #${row.id} has been fully approved by ${req.user.names}.`,
        actor: req.user,
        note: req.body.comment,
      }),
    });
  }
  return ok(res, await loadLeave(row.id), "Leave request approved");
});

export const rejectLeave = asyncHandler(async (req, res) => {
  const row = await loadLeave(req.params.id);
  if (!row) return fail(res, "Leave request not found", 404);
  if (!isDesignatedApprover(req.user, row) || !allowApprove(row)) {
    return fail(res, "You cannot reject this leave request", 403);
  }
  const reason = String(req.body.reason || req.body.comment || "").trim();
  await row.update({ leave_requests_status: "rejected" });
  await addLeaveLog(row.id, "rejected", req.user.id, reason || "Rejected");
  await createNotification({
      whatsapp: true,
    receiverId: row.user_id,
    type: "leave_request",
    title: `Leave Request #${row.id} rejected`,
    message: reason ? `Your leave request was rejected. Reason: ${reason}` : "Your leave request was rejected.",
    link: `/leave-requests/${row.id}`,
      priority: requireNotificationPriority(req.body) || "middle",
    emailPayload: buildEmailPayload("leave", row, {
      intro: "Your leave request was rejected. See the comment below for more information.",
      actor: req.user,
      note: reason,
    }),
  });
  return ok(res, await loadLeave(row.id), "Leave request rejected");
});
