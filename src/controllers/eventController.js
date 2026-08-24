import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { isAdminRole } from "../utils/roleHelpers.js";
import fileStorage from "../utils/fileStorage.js";
const { saveRequestFile } = fileStorage;

const eventInclude = [{ model: db.EventImages, as: "event_images_eid" }];

export const getEvents = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) where.title = { [Op.iLike]: `%${req.query.search}%` };
  const { rows, count } = await db.Events.findAndCountAll({
    where,
    include: eventInclude,
    order: [["date", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getEvent = asyncHandler(async (req, res) => {
  const row = await db.Events.findByPk(req.params.id, { include: eventInclude });
  if (!row) return fail(res, "Event not found", 404);
  return ok(res, row);
});

export const createEvent = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  let image = req.body.image;
  try {
    const saved = saveRequestFile(req, "events", { prefix: "event", fieldNames: ["image", "file"] });
    if (saved) image = saved.dbPath;
  } catch (error) {
    return fail(res, error.message);
  }
  if (!req.body.title || !req.body.date || !image) {
    return fail(res, "title, date, and image are required");
  }
  const row = await db.Events.create({
    title: req.body.title,
    description: req.body.description || null,
    date: req.body.date,
    image,
    status: req.body.status || "draft",
  });
  const images = Array.isArray(req.body.images) ? req.body.images : [];
  if (images.length) {
    await db.EventImages.bulkCreate(images.map((url) => ({ eid: row.id, url })));
  }
  await createLog(req.user.id, "create_event", `Created event #${row.id}`);
  return created(res, await db.Events.findByPk(row.id, { include: eventInclude }), "Event created");
});

export const updateEvent = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Events.findByPk(req.params.id);
  if (!row) return fail(res, "Event not found", 404);
  let image = req.body.image || row.image;
  try {
    const saved = saveRequestFile(req, "events", { prefix: "event", fieldNames: ["image", "file"] });
    if (saved) image = saved.dbPath;
  } catch (error) {
    return fail(res, error.message);
  }
  await row.update({
    title: req.body.title || row.title,
    description: req.body.description !== undefined ? req.body.description : row.description,
    date: req.body.date || row.date,
    image,
    status: req.body.status || row.status,
  });
  return ok(res, await db.Events.findByPk(row.id, { include: eventInclude }), "Event updated");
});

export const addEventImage = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Events.findByPk(req.params.id);
  if (!row) return fail(res, "Event not found", 404);
  if (!req.body.url) {
    try {
      const saved = saveRequestFile(req, "events", { prefix: "event", fieldNames: ["image", "file", "url"] });
      if (saved) req.body.url = saved.dbPath;
    } catch (error) {
      return fail(res, error.message);
    }
  }
  if (!req.body.url) return fail(res, "url is required");
  const image = await db.EventImages.create({ eid: row.id, url: req.body.url });
  return created(res, image, "Event image added");
});

export const deleteEventImage = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const image = await db.EventImages.findOne({ where: { id: req.params.imageId, eid: req.params.id } });
  if (!image) return fail(res, "Event image not found", 404);
  await image.destroy();
  return ok(res, null, "Event image deleted");
});

export const deleteEvent = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Events.findByPk(req.params.id);
  if (!row) return fail(res, "Event not found", 404);
  await db.EventImages.destroy({ where: { eid: row.id } });
  await row.destroy();
  return ok(res, null, "Event deleted");
});
