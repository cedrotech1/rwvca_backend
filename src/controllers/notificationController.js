import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { sanitizeNotificationRow } from "../utils/plainText.js";

const Notifications = db.Notifications;

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = { receiver_id: req.user.id };
  if (req.query.status) where.status = req.query.status;

  const { rows, count } = await Notifications.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });

  return ok(res, {
    items: rows.map(sanitizeNotificationRow),
    pagination: paginationMeta(count, page, limit),
  });
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await Notifications.count({
    where: { receiver_id: req.user.id, status: "unread" },
  });
  return ok(res, { count });
});

export const markRead = asyncHandler(async (req, res) => {
  const row = await Notifications.findOne({
    where: { id: req.params.id, receiver_id: req.user.id },
  });
  if (!row) return fail(res, "Notification not found", 404);
  await row.update({ status: "read" });
  return ok(res, sanitizeNotificationRow(row), "Marked as read");
});

export const markAllRead = asyncHandler(async (req, res) => {
  const [count] = await Notifications.update(
    { status: "read" },
    { where: { receiver_id: req.user.id, status: "unread" } }
  );
  return ok(res, { updated: count }, "All notifications marked as read");
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const deleted = await Notifications.destroy({
    where: { id: req.params.id, receiver_id: req.user.id },
  });
  if (!deleted) return fail(res, "Notification not found", 404);
  return ok(res, null, "Notification deleted");
});

export const deleteAllNotifications = asyncHandler(async (req, res) => {
  const deleted = await Notifications.destroy({
    where: { receiver_id: req.user.id },
  });
  return ok(res, { deleted }, "All notifications deleted");
});
