import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { findUserByRole, USER_PUBLIC } from "../services/workflowUsers.js";
import { isAdminRole, isEdRole, isExactHr, isExecutiveRole } from "../utils/roleHelpers.js";

const USER_ATTR = { attributes: USER_PUBLIC };

function canManageSchedule(role) {
  return isExactHr(role) || isEdRole(role) || isAdminRole(role);
}

function canAccess(user, row) {
  if (canManageSchedule(user.role) || isExecutiveRole(user.role)) return true;
  return Number(row.user_id) === Number(user.id);
}

async function loadRow(id) {
  return db.LeaveSchedule.findByPk(id, {
    include: [
      { model: db.Users, as: "user", ...USER_ATTR, include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }] },
      {
        model: db.LeaveScheduleReplies,
        as: "leave_schedule_replies_leave_schedule_id",
        include: [
          { model: db.Users, as: "sender", attributes: ["id", "names", "email", "role"] },
          { model: db.Users, as: "receiver", attributes: ["id", "names", "email", "role"] },
        ],
      },
    ],
    order: [[{ model: db.LeaveScheduleReplies, as: "leave_schedule_replies_leave_schedule_id" }, "id", "ASC"]],
  });
}

export const getLeaveSchedules = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  if (!canManageSchedule(req.user.role)) where.user_id = req.user.id;
  if (req.query.status) where.status = req.query.status;
  if (req.query.user_id && canManageSchedule(req.user.role)) where.user_id = req.query.user_id;
  if (req.query.hr_read_status) where.hr_read_status = req.query.hr_read_status;
  if (req.query.ed_read_status) where.ed_read_status = req.query.ed_read_status;
  if (req.query.from_date) where.from_date = { [Op.gte]: req.query.from_date };
  if (req.query.to_date) where.return_date = { ...(where.return_date || {}), [Op.lte]: req.query.to_date };

  const { rows, count } = await db.LeaveSchedule.findAndCountAll({
    where,
    include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getLeaveSchedule = asyncHandler(async (req, res) => {
  const row = await loadRow(req.params.id);
  if (!row) return fail(res, "Leave schedule not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  return ok(res, {
    ...row.toJSON(),
    permissions: {
      can_edit:
        Number(row.user_id) === Number(req.user.id) &&
        row.status === "pending" &&
        row.hr_read_status === "unread" &&
        row.ed_read_status === "unread",
      can_approve: canManageSchedule(req.user.role) && row.status === "pending",
      can_reject: canManageSchedule(req.user.role) && row.status === "pending",
      can_mark_hr_read: (isExactHr(req.user.role) || isAdminRole(req.user.role)) && row.hr_read_status !== "read",
      can_mark_ed_read: (isEdRole(req.user.role) || isAdminRole(req.user.role)) && row.ed_read_status !== "read",
      can_delete: canManageSchedule(req.user.role) || Number(row.user_id) === Number(req.user.id),
    },
  });
});

export const createLeaveSchedule = asyncHandler(async (req, res) => {
  const from_date = req.body.from_date;
  const return_date = req.body.return_date;
  if (!from_date || !return_date) return fail(res, "from_date and return_date are required");
  if (new Date(return_date) < new Date(from_date)) return fail(res, "Return date cannot be before from date");

  const row = await db.LeaveSchedule.create({
    user_id: req.user.id,
    from_date,
    return_date,
    status: "pending",
    hr_read_status: "unread",
    ed_read_status: "unread",
  });
  await createLog(req.user.id, "create_leave_schedule", `Created leave schedule #${row.id}`);

  const loaded = await loadRow(row.id);
  const [hr, ed] = await Promise.all([findUserByRole("HR"), findUserByRole("ED")]);
  for (const officer of [hr, ed].filter(Boolean)) {
    await createNotification({
      whatsapp: true,
      receiverId: officer.id,
      type: "leave_schedule",
      title: "New leave schedule submitted",
      message: `${req.user.names} submitted leave from ${from_date} to ${return_date}.`,
      link: `/leave-schedule/${row.id}`,
      emailPayload: buildEmailPayload("leave_schedule", loaded, {
        intro: `${req.user.names} has submitted a leave schedule for your review.`,
        actor: req.user,
        applicant: req.user,
        actionRequired: "Please review the scheduled leave dates and approve or reject as appropriate.",
      }),
    });
  }
  return created(res, loaded, "Leave schedule added");
});

export const updateLeaveSchedule = asyncHandler(async (req, res) => {
  const row = await db.LeaveSchedule.findByPk(req.params.id);
  if (!row) return fail(res, "Leave schedule not found", 404);
  if (Number(row.user_id) !== Number(req.user.id)) return fail(res, "Access denied", 403);
  if (row.status !== "pending" || row.hr_read_status !== "unread" || row.ed_read_status !== "unread") {
    return fail(res, "You can only edit your own pending leave schedules that haven't been read yet.");
  }
  const from_date = req.body.from_date || row.from_date;
  const return_date = req.body.return_date || row.return_date;
  if (new Date(return_date) < new Date(from_date)) return fail(res, "Return date cannot be before from date");
  await row.update({ from_date, return_date });
  return ok(res, await loadRow(row.id), "Leave schedule updated");
});

export const updateLeaveScheduleStatus = asyncHandler(async (req, res) => {
  const row = await db.LeaveSchedule.findByPk(req.params.id);
  if (!row) return fail(res, "Leave schedule not found", 404);
  if (!canManageSchedule(req.user.role)) return fail(res, "You don't have permission to change leave schedule status.", 403);
  const status = req.body.status === "rejected" || req.body.action === "reject" ? "rejected" : "approved";
  await row.update({
    status,
    status_changed_by: req.user.id,
    status_changed_at: new Date(),
  });
  const loaded = await loadRow(row.id);
  await createNotification({
      whatsapp: true,
    receiverId: row.user_id,
    type: "leave_schedule_status",
    title: `Leave schedule ${status}`,
    message: `Your leave schedule from ${row.from_date} to ${row.return_date} was ${status}.`,
    link: `/leave-schedule/${row.id}`,
    emailPayload: buildEmailPayload("leave_schedule", loaded, {
      intro: `Your leave schedule has been ${status} by ${req.user.names}.`,
      actor: req.user,
      note: req.body.comment || req.body.reason,
      actionRequired: status === "rejected" ? "Please contact HR if you need clarification or wish to submit a revised schedule." : undefined,
    }),
  });
  return ok(res, loaded, `Leave schedule ${status}`);
});

export const markLeaveScheduleRead = asyncHandler(async (req, res) => {
  const row = await db.LeaveSchedule.findByPk(req.params.id);
  if (!row) return fail(res, "Leave schedule not found", 404);
  const markType = req.body.mark_type || (isEdRole(req.user.role) ? "ed" : "hr");
  if (markType === "hr" && !isExactHr(req.user.role) && !isAdminRole(req.user.role)) {
    return fail(res, "You can only mark as read for your role.", 403);
  }
  if (markType === "ed" && !isEdRole(req.user.role) && !isAdminRole(req.user.role)) {
    return fail(res, "You can only mark as read for your role.", 403);
  }
  if (markType === "ed") {
    await row.update({ ed_read_status: "read", ed_read_at: new Date() });
  } else {
    await row.update({ hr_read_status: "read", hr_read_at: new Date() });
  }
  return ok(res, await loadRow(row.id), "Marked as read");
});

export const addLeaveScheduleReply = asyncHandler(async (req, res) => {
  const row = await db.LeaveSchedule.findByPk(req.params.id);
  if (!row) return fail(res, "Leave schedule not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  const message = String(req.body.message || "").trim();
  if (!message) return fail(res, "message is required");

  const receiver_id = Number(row.user_id) === Number(req.user.id) ? null : row.user_id;
  const reply = await db.LeaveScheduleReplies.create({
    leave_schedule_id: row.id,
    sender_id: req.user.id,
    receiver_id,
    message,
    reply_type: req.body.reply_type || "comment",
    is_internal: req.body.is_internal ? 1 : 0,
  });
  await row.update({
    last_reply_at: new Date(),
    last_reply_by: req.user.id,
    unread_reply_count: Number(row.unread_reply_count || 0) + 1,
  });

  const notifyId = receiver_id || (await findUserByRole("HR"))?.id;
  if (notifyId && Number(notifyId) !== Number(req.user.id)) {
    const loaded = await loadRow(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: notifyId,
      type: "leave_schedule_reply",
      title: "New leave schedule reply",
      message: `${req.user.names} replied on leave schedule #${row.id}.`,
      link: `/leave-schedule/${row.id}`,
      emailPayload: buildEmailPayload("leave_schedule", loaded, {
        intro: `${req.user.names} posted a reply on leave schedule #${row.id}.`,
        actor: req.user,
        note: message,
      }),
    });
  }
  return created(res, reply, "Reply added");
});

export const deleteLeaveSchedule = asyncHandler(async (req, res) => {
  const row = await db.LeaveSchedule.findByPk(req.params.id);
  if (!row) return fail(res, "Leave schedule not found", 404);
  if (!canManageSchedule(req.user.role) && Number(row.user_id) !== Number(req.user.id)) {
    return fail(res, "You don't have permission to delete this leave schedule.", 403);
  }
  await db.LeaveScheduleReplies.destroy({ where: { leave_schedule_id: row.id } });
  await row.destroy();
  await createLog(req.user.id, "delete_leave_schedule", `Deleted leave schedule #${req.params.id}`);
  return ok(res, null, "Leave schedule deleted");
});
