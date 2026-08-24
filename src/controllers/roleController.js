import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { createLog } from "../services/logService.js";
import { canManageUsers } from "../utils/roleHelpers.js";

const Roles = db.Roles;

export const getRoles = asyncHandler(async (req, res) => {
  const items = await Roles.findAll({ order: [["role_name", "ASC"]] });
  return ok(res, items);
});

export const createRole = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const role_name = String(req.body.role_name || "").trim();
  if (!role_name) return fail(res, "Role name is required");
  const exists = await Roles.findOne({ where: { role_name } });
  if (exists) return fail(res, "Role already exists");
  const row = await Roles.create({
    role_name,
    description: req.body.description || null,
  });
  await createLog(req.user.id, "create_role", `Created role ${role_name}`);
  return created(res, row, "Role created");
});

export const updateRole = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const row = await Roles.findByPk(req.params.id);
  if (!row) return fail(res, "Role not found", 404);
  await row.update({
    role_name: req.body.role_name || row.role_name,
    description: req.body.description !== undefined ? req.body.description : row.description,
  });
  await createLog(req.user.id, "update_role", `Updated role #${row.id}`);
  return ok(res, row, "Role updated");
});

export const deleteRole = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const row = await Roles.findByPk(req.params.id);
  if (!row) return fail(res, "Role not found", 404);
  await row.destroy();
  await createLog(req.user.id, "delete_role", `Deleted role #${req.params.id}`);
  return ok(res, null, "Role deleted");
});
