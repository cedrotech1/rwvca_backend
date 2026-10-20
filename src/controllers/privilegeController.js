import asyncHandler from "express-async-handler";
import { ok, fail } from "../utils/apiResponse.js";
import { createLog } from "../services/logService.js";
import { canManageRoles } from "../utils/roleHelpers.js";
import {
  getRolePrivilegeMatrix,
  listPrivileges,
  reseedRoleDefaults,
  setRolePrivileges,
} from "../services/privilegeService.js";

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

export const updateRolePrivileges = asyncHandler(async (req, res) => {
  if (!canManageRoles(req.user)) return fail(res, "Access denied", 403);
  const roleId = Number(req.params.roleId || req.params.id);
  if (!roleId) return fail(res, "Role id is required");
  const privilegeIds = req.body.privilege_ids ?? req.body.privileges ?? [];
  const data = await setRolePrivileges(roleId, privilegeIds);
  if (!data) return fail(res, "Role not found", 404);
  await createLog(
    req.user.id,
    "update_role_privileges",
    `Updated privileges for role #${roleId}`
  );
  return ok(res, data, "Role privileges updated");
});

export const restoreRolePrivilegeDefaults = asyncHandler(async (req, res) => {
  if (!canManageRoles(req.user)) return fail(res, "Access denied", 403);
  const roleId = Number(req.params.roleId || req.params.id);
  if (!roleId) return fail(res, "Role id is required");
  const data = await reseedRoleDefaults(roleId);
  if (!data) return fail(res, "Role not found", 404);
  await createLog(
    req.user.id,
    "restore_role_privileges",
    `Restored default privileges for role #${roleId}`
  );
  return ok(res, data, "Default privileges restored");
});
