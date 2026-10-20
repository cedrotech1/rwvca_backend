import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail } from "../utils/apiResponse.js";
import { createLog } from "../services/logService.js";
import { canManageRoles } from "../utils/roleHelpers.js";
import {
  getRolePrivilegeMatrix,
  getUsersForRoleName,
  listPrivileges,
  reseedRoleDefaults,
  setRolePrivileges,
} from "../services/privilegeService.js";

function formatPrivilegeChangeLog(change, verb = "Updated") {
  if (!change) return `${verb} role privileges`;
  const added = (change.added || []).join(", ") || "none";
  const removed = (change.removed || []).join(", ") || "none";
  return `${verb} privileges for role "${change.role_name}" (#${change.role_id}): total=${change.total}; added=[${added}]; removed=[${removed}]`;
}

export const getPrivileges = asyncHandler(async (req, res) => {
  if (!canManageRoles(req.user)) return fail(res, "Access denied", 403);
  const items = await listPrivileges();
  return ok(res, items);
});

export const getRolePrivilegeMatrixHandler = asyncHandler(async (req, res) => {
  if (!canManageRoles(req.user)) return fail(res, "Access denied", 403);
  const data = await getRolePrivilegeMatrix();
  return ok(res, data);
});

export const getRoleUsers = asyncHandler(async (req, res) => {
  if (!canManageRoles(req.user)) return fail(res, "Access denied", 403);
  const roleId = Number(req.params.roleId || req.params.id);
  if (!roleId) return fail(res, "Role id is required");
  const role = await db.Roles.findByPk(roleId);
  if (!role) return fail(res, "Role not found", 404);
  const users = await getUsersForRoleName(role.role_name);
  return ok(res, {
    role: { id: role.id, role_name: role.role_name },
    users,
    count: users.length,
  });
});

export const updateRolePrivileges = asyncHandler(async (req, res) => {
  if (!canManageRoles(req.user)) return fail(res, "Access denied", 403);
  const roleId = Number(req.params.roleId || req.params.id);
  if (!roleId) return fail(res, "Role id is required");
  const privilegeIds = req.body.privilege_ids ?? req.body.privileges ?? [];
  const result = await setRolePrivileges(roleId, privilegeIds);
  if (!result) return fail(res, "Role not found", 404);
  await createLog(
    req.user.id,
    "update_role_privileges",
    formatPrivilegeChangeLog(result.change, "Updated")
  );
  return ok(res, result.matrix, "Role privileges updated");
});

export const restoreRolePrivilegeDefaults = asyncHandler(async (req, res) => {
  if (!canManageRoles(req.user)) return fail(res, "Access denied", 403);
  const roleId = Number(req.params.roleId || req.params.id);
  if (!roleId) return fail(res, "Role id is required");
  const result = await reseedRoleDefaults(roleId);
  if (!result) return fail(res, "Role not found", 404);
  await createLog(
    req.user.id,
    "restore_role_privileges",
    formatPrivilegeChangeLog(result.change, "Restored defaults for")
  );
  return ok(res, result.matrix, "Default privileges restored");
});
