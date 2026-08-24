import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { createLog } from "../services/logService.js";
import { canManageUsers } from "../utils/roleHelpers.js";

const Department = db.Department;

export const getDepartments = asyncHandler(async (req, res) => {
  const items = await Department.findAll({ order: [["name", "ASC"]] });
  return ok(res, items);
});

export const createDepartment = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const name = String(req.body.name || "").trim();
  if (!name) return fail(res, "Department name is required");
  const exists = await Department.findOne({ where: { name } });
  if (exists) return fail(res, "Department already exists");
  const row = await Department.create({ name });
  await createLog(req.user.id, "create_department", `Created department ${name}`);
  return created(res, row, "Department created");
});

export const updateDepartment = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const row = await Department.findByPk(req.params.id);
  if (!row) return fail(res, "Department not found", 404);
  const name = String(req.body.name || "").trim();
  if (!name) return fail(res, "Department name is required");
  await row.update({ name });
  await createLog(req.user.id, "update_department", `Updated department #${row.id}`);
  return ok(res, row, "Department updated");
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const row = await Department.findByPk(req.params.id);
  if (!row) return fail(res, "Department not found", 404);
  const userCount = await db.Users.count({ where: { department_ID: row.id } });
  if (userCount > 0) {
    return fail(res, `Cannot delete department. It is assigned to ${userCount} user(s).`);
  }
  await row.destroy();
  await createLog(req.user.id, "delete_department", `Deleted department #${req.params.id}`);
  return ok(res, null, "Department deleted");
});
