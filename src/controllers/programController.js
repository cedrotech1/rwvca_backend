import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { isAdminRole } from "../utils/roleHelpers.js";
import fileStorage from "../utils/fileStorage.js";
const { saveRequestFile } = fileStorage;

const programInclude = [{ model: db.ProgramImages, as: "images" }];

export const getPrograms = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.category) where.category = req.query.category;
  if (req.query.search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${req.query.search}%` } },
      { description: { [Op.iLike]: `%${req.query.search}%` } },
    ];
  }
  const { rows, count } = await db.Programs.findAndCountAll({
    where,
    include: programInclude,
    order: [["id", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getProgram = asyncHandler(async (req, res) => {
  const row = await db.Programs.findByPk(req.params.id, { include: programInclude });
  if (!row) return fail(res, "Program not found", 404);
  return ok(res, row);
});

export const createProgram = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.title || !req.body.description || !req.body.application_deadline || !req.body.requirements) {
    return fail(res, "title, description, application_deadline, and requirements are required");
  }
  const row = await db.Programs.create({
    title: req.body.title,
    description: req.body.description,
    application_deadline: req.body.application_deadline,
    requirements: req.body.requirements,
    why_apply: req.body.why_apply || null,
    application_link: req.body.application_link || null,
    status: req.body.status || "active",
    category: req.body.category || "upcoming",
  });
  const images = Array.isArray(req.body.images) ? req.body.images : [];
  try {
    const saved = saveRequestFile(req, "programs", { prefix: "program", fieldNames: ["image", "file"] });
    if (saved) images.push(saved.dbPath);
  } catch (error) {
    return fail(res, error.message);
  }
  if (images.length) {
    await db.ProgramImages.bulkCreate(images.map((url) => ({ pid: row.id, url })));
  }
  await createLog(req.user.id, "create_program", `Created program #${row.id}`);
  return created(res, await db.Programs.findByPk(row.id, { include: programInclude }), "Program created");
});

export const updateProgram = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Programs.findByPk(req.params.id);
  if (!row) return fail(res, "Program not found", 404);
  await row.update({
    title: req.body.title || row.title,
    description: req.body.description !== undefined ? req.body.description : row.description,
    application_deadline: req.body.application_deadline || row.application_deadline,
    requirements: req.body.requirements !== undefined ? req.body.requirements : row.requirements,
    why_apply: req.body.why_apply !== undefined ? req.body.why_apply : row.why_apply,
    application_link: req.body.application_link !== undefined ? req.body.application_link : row.application_link,
    status: req.body.status || row.status,
    category: req.body.category || row.category,
  });
  try {
    const saved = saveRequestFile(req, "programs", { prefix: "program", fieldNames: ["image", "file"] });
    if (saved) {
      await db.ProgramImages.create({ pid: row.id, url: saved.dbPath });
    }
  } catch (error) {
    return fail(res, error.message);
  }
  return ok(res, await db.Programs.findByPk(row.id, { include: programInclude }), "Program updated");
});

export const addProgramImage = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Programs.findByPk(req.params.id);
  if (!row) return fail(res, "Program not found", 404);
  if (!req.body.url) {
    try {
      const saved = saveRequestFile(req, "programs", { prefix: "program", fieldNames: ["image", "file", "url"] });
      if (saved) req.body.url = saved.dbPath;
    } catch (error) {
      return fail(res, error.message);
    }
  }
  if (!req.body.url) return fail(res, "url is required");
  const image = await db.ProgramImages.create({ pid: row.id, url: req.body.url });
  return created(res, image, "Program image added");
});

export const deleteProgramImage = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const image = await db.ProgramImages.findOne({ where: { id: req.params.imageId, pid: req.params.id } });
  if (!image) return fail(res, "Program image not found", 404);
  await image.destroy();
  return ok(res, null, "Program image deleted");
});

export const deleteProgram = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Programs.findByPk(req.params.id);
  if (!row) return fail(res, "Program not found", 404);
  await db.ProgramImages.destroy({ where: { pid: row.id } });
  await row.destroy();
  return ok(res, null, "Program deleted");
});
