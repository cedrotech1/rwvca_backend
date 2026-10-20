import db from "../database/models/index.js";
import { attachPrivileges } from "./privilegeService.js";

const UserActingRoles = db.UserActingRoles;

function normalizeRole(role) {
  return String(role || "").trim();
}

function normalizeKey(role) {
  return normalizeRole(role).toLowerCase();
}

/** Distinct acting role labels for a user (excludes empty). */
export async function getActingRoles(userId) {
  if (!userId || !UserActingRoles) return [];
  const rows = await UserActingRoles.findAll({
    where: { user_id: Number(userId) },
    attributes: ["role"],
    order: [["role", "ASC"]],
  });
  return rows.map((row) => normalizeRole(row.role)).filter(Boolean);
}

/**
 * Replace acting roles for a user.
 * Primary role is never stored here; duplicates of primary are dropped.
 */
export async function setActingRoles(userId, roles, primaryRole = null) {
  if (!userId || !UserActingRoles) return [];
  const primaryKey = normalizeKey(primaryRole);
  const seen = new Set();
  const cleaned = [];
  for (const raw of Array.isArray(roles) ? roles : []) {
    const label = normalizeRole(raw);
    const key = normalizeKey(label);
    if (!label || !key) continue;
    if (primaryKey && key === primaryKey) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(label);
  }

  await UserActingRoles.destroy({ where: { user_id: Number(userId) } });
  if (cleaned.length) {
    await UserActingRoles.bulkCreate(
      cleaned.map((role) => ({ user_id: Number(userId), role }))
    );
  }
  return cleaned;
}

export async function getActingRolesMap(userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter(Boolean))];
  if (!ids.length || !UserActingRoles) return new Map();
  const rows = await UserActingRoles.findAll({
    where: { user_id: ids },
    attributes: ["user_id", "role"],
    order: [["role", "ASC"]],
  });
  const map = new Map();
  for (const row of rows) {
    const id = Number(row.user_id);
    const list = map.get(id) || [];
    const role = normalizeRole(row.role);
    if (role) list.push(role);
    map.set(id, list);
  }
  return map;
}

/** Attach acting_roles + effective_roles onto a plain user object. */
export function withEffectiveRoles(user, actingRoles = []) {
  if (!user) return user;
  const plain = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  const acting = (Array.isArray(actingRoles) ? actingRoles : [])
    .map(normalizeRole)
    .filter(Boolean);
  const primary = normalizeRole(plain.role);
  const effective = [];
  const seen = new Set();
  for (const role of [primary, ...acting]) {
    const key = normalizeKey(role);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    effective.push(role);
  }
  plain.acting_roles = acting;
  plain.effective_roles = effective;
  return plain;
}

export async function attachActingRoles(user) {
  if (!user) return user;
  const acting = await getActingRoles(user.id);
  const plain = withEffectiveRoles(user, acting);
  return attachPrivileges(plain);
}
