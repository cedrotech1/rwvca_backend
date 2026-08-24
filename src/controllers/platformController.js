import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { isAdminRole } from "../utils/roleHelpers.js";
import fileStorage from "../utils/fileStorage.js";
const { saveRequestFile } = fileStorage;

const platformInclude = [{ model: db.PlatformDetails, as: "details" }];

export const getPlatforms = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${req.query.search}%` } },
      { description: { [Op.iLike]: `%${req.query.search}%` } },
    ];
  }
  const { rows, count } = await db.Platforms.findAndCountAll({
    where,
    include: platformInclude,
    order: [["display_order", "ASC"], ["id", "ASC"]],
    limit,
    offset,
    distinct: true,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getPlatform = asyncHandler(async (req, res) => {
  const row = await db.Platforms.findByPk(req.params.id, { include: platformInclude });
  if (!row) return fail(res, "Platform not found", 404);
  return ok(res, row);
});

export const createPlatform = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.name || !req.body.description) return fail(res, "name and description are required");
  let image = req.body.image || null;
  try {
    const saved = saveRequestFile(req, "platforms", { prefix: "platform", fieldNames: ["image", "file"] });
    if (saved) image = saved.dbPath;
  } catch (error) {
    return fail(res, error.message);
  }
  const row = await db.Platforms.create({
    name: req.body.name,
    description: req.body.description,
    image,
    status: req.body.status || "published",
    display_order: req.body.display_order || 0,
  });
  const details = Array.isArray(req.body.details) ? req.body.details : [];
  if (details.length) {
    await db.PlatformDetails.bulkCreate(
      details.map((item) => ({
        pid: row.id,
        title: item.title,
        subtitle: item.subtitle || null,
        value: item.value || null,
      }))
    );
  }
  await createLog(req.user.id, "create_platform", `Created platform #${row.id}`);
  return created(res, await db.Platforms.findByPk(row.id, { include: platformInclude }), "Platform created");
});

export const updatePlatform = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Platforms.findByPk(req.params.id);
  if (!row) return fail(res, "Platform not found", 404);
  let image = req.body.image !== undefined ? req.body.image : row.image;
  try {
    const saved = saveRequestFile(req, "platforms", { prefix: "platform", fieldNames: ["image", "file"] });
    if (saved) image = saved.dbPath;
  } catch (error) {
    return fail(res, error.message);
  }
  await row.update({
    name: req.body.name || row.name,
    description: req.body.description !== undefined ? req.body.description : row.description,
    image,
    status: req.body.status || row.status,
    display_order: req.body.display_order !== undefined ? req.body.display_order : row.display_order,
  });
  return ok(res, await db.Platforms.findByPk(row.id, { include: platformInclude }), "Platform updated");
});

export const addPlatformDetail = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Platforms.findByPk(req.params.id);
  if (!row) return fail(res, "Platform not found", 404);
  if (!req.body.title) return fail(res, "title is required");
  const detail = await db.PlatformDetails.create({
    pid: row.id,
    title: req.body.title,
    subtitle: req.body.subtitle || null,
    value: req.body.value || null,
  });
  return created(res, detail, "Platform detail added");
});

export const updatePlatformDetail = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const detail = await db.PlatformDetails.findOne({ where: { id: req.params.detailId, pid: req.params.id } });
  if (!detail) return fail(res, "Platform detail not found", 404);
  await detail.update({
    title: req.body.title || detail.title,
    subtitle: req.body.subtitle !== undefined ? req.body.subtitle : detail.subtitle,
    value: req.body.value !== undefined ? req.body.value : detail.value,
  });
  return ok(res, detail, "Platform detail updated");
});

export const deletePlatformDetail = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const detail = await db.PlatformDetails.findOne({ where: { id: req.params.detailId, pid: req.params.id } });
  if (!detail) return fail(res, "Platform detail not found", 404);
  await detail.destroy();
  return ok(res, null, "Platform detail deleted");
});

export const deletePlatform = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Platforms.findByPk(req.params.id);
  if (!row) return fail(res, "Platform not found", 404);
  await db.PlatformDetails.destroy({ where: { pid: row.id } });
  await row.destroy();
  return ok(res, null, "Platform deleted");
});
