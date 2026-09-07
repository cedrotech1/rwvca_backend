import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { sanitizeNotificationRow } from "../utils/plainText.js";
import {
  normalizeNotificationPriority,
  NOTIFICATION_PRIORITY_RANK,
  NOTIFICATION_PRIORITIES,
} from "../utils/notificationPriority.js";

const Notifications = db.Notifications;

function sortByPriorityThenDate(rows = []) {
  return [...rows].sort((a, b) => {
    const rankA = NOTIFICATION_PRIORITY_RANK[normalizeNotificationPriority(a.priority)] ?? 99;
    const rankB = NOTIFICATION_PRIORITY_RANK[normalizeNotificationPriority(b.priority)] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = { receiver_id: req.user.id };
  if (req.query.status) where.status = req.query.status;
  if (req.query.priority) {
    const priority = normalizeNotificationPriority(req.query.priority, { required: true });
    if (!priority) return fail(res, "Invalid priority filter");
    where.priority = priority;
  }

  const { rows, count } = await Notifications.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });

  const items = sortByPriorityThenDate(rows.map(sanitizeNotificationRow));

  return ok(res, {
    items,
    priorities: NOTIFICATION_PRIORITIES,
    pagination: paginationMeta(count, page, limit),
  });
});

export const unreadCount = asyncHandler(async (req, res) => {
  const where = { receiver_id: req.user.id, status: "unread" };
  const count = await Notifications.count({ where });
  const byPriorityRows = await Notifications.findAll({
    attributes: [
      "priority",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    where,
    group: ["priority"],
    raw: true,
  });

  const by_priority = {
    urgent: 0,
    high: 0,
    middle: 0,
    low: 0,
  };
  byPriorityRows.forEach((row) => {
    const key = normalizeNotificationPriority(row.priority);
    by_priority[key] = Number(row.count || 0);
  });

  return ok(res, {
    count,
    urgent_count: by_priority.urgent,
    high_count: by_priority.high,
    by_priority,
  });
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
