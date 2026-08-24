import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { createLog } from "../services/logService.js";
import { isAdminRole } from "../utils/roleHelpers.js";

export const getOrganizationUnits = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.level) where.level = req.query.level;
  if (req.query.is_active !== undefined) where.is_active = Number(req.query.is_active);
  if (req.query.search) {
    where[Op.or] = [
      { unit_name: { [Op.iLike]: `%${req.query.search}%` } },
      { title: { [Op.iLike]: `%${req.query.search}%` } },
    ];
  }
  const items = await db.OrganizationStructure.findAll({
    where,
    order: [["display_order", "ASC"], ["id", "ASC"]],
  });
  return ok(res, { items });
});

export const getOrganizationUnit = asyncHandler(async (req, res) => {
  const row = await db.OrganizationStructure.findByPk(req.params.id);
  if (!row) return fail(res, "Organization unit not found", 404);
  return ok(res, row);
});

export const createOrganizationUnit = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.unit_name || !req.body.unit_key || !req.body.level || !req.body.title || !req.body.content) {
    return fail(res, "unit_name, unit_key, level, title, and content are required");
  }
  const row = await db.OrganizationStructure.create({
    unit_name: req.body.unit_name,
    unit_key: req.body.unit_key,
    level: req.body.level,
    title: req.body.title,
    content: req.body.content,
    display_order: req.body.display_order || 0,
    is_active: req.body.is_active === undefined ? 1 : Number(req.body.is_active),
  });
  await createLog(req.user.id, "create_organization", `Created organization unit #${row.id}`);
  return created(res, row, "Organization unit created");
});

export const updateOrganizationUnit = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.OrganizationStructure.findByPk(req.params.id);
  if (!row) return fail(res, "Organization unit not found", 404);
  await row.update({
    unit_name: req.body.unit_name || row.unit_name,
    unit_key: req.body.unit_key || row.unit_key,
    level: req.body.level || row.level,
    title: req.body.title || row.title,
    content: req.body.content !== undefined ? req.body.content : row.content,
    display_order: req.body.display_order !== undefined ? req.body.display_order : row.display_order,
    is_active: req.body.is_active !== undefined ? Number(req.body.is_active) : row.is_active,
  });
  return ok(res, row, "Organization unit updated");
});

export const deleteOrganizationUnit = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.OrganizationStructure.findByPk(req.params.id);
  if (!row) return fail(res, "Organization unit not found", 404);
  await row.destroy();
  return ok(res, null, "Organization unit deleted");
});
