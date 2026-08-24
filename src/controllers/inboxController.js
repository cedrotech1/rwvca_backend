import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { isAdminRole } from "../utils/roleHelpers.js";

export const getContactMessages = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const { page, limit, offset } = getPagination(req);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${req.query.search}%` } },
      { email: { [Op.iLike]: `%${req.query.search}%` } },
      { subject: { [Op.iLike]: `%${req.query.search}%` } },
    ];
  }
  const { rows, count } = await db.ContactMessages.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getContactMessage = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.ContactMessages.findByPk(req.params.id);
  if (!row) return fail(res, "Message not found", 404);
  if (row.status === "unread") await row.update({ status: "read" });
  return ok(res, row);
});

export const updateContactMessageStatus = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.ContactMessages.findByPk(req.params.id);
  if (!row) return fail(res, "Message not found", 404);
  await row.update({ status: req.body.status || "read" });
  return ok(res, row, "Message status updated");
});

export const deleteContactMessage = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.ContactMessages.findByPk(req.params.id);
  if (!row) return fail(res, "Message not found", 404);
  await row.destroy();
  await createLog(req.user.id, "delete_contact_message", `Deleted contact message #${req.params.id}`);
  return ok(res, null, "Message deleted");
});

export const getSubscribers = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const { page, limit, offset } = getPagination(req);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) where.email = { [Op.iLike]: `%${req.query.search}%` };
  const { rows, count } = await db.Subscribers.findAndCountAll({
    where,
    order: [["subscribed_at", "DESC"]],
    limit,
    offset,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const updateSubscriber = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Subscribers.findByPk(req.params.id);
  if (!row) return fail(res, "Subscriber not found", 404);
  await row.update({ status: req.body.status || row.status });
  return ok(res, row, "Subscriber updated");
});

export const deleteSubscriber = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Subscribers.findByPk(req.params.id);
  if (!row) return fail(res, "Subscriber not found", 404);
  await row.destroy();
  return ok(res, null, "Subscriber deleted");
});
