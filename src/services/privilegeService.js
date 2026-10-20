import { Op } from "sequelize";
import db from "../database/models/index.js";
import {
  DEFAULT_ROLE_PRIVILEGES,
  ROLE_NAME_ALIASES,
  resolveSeedRoleKey,
} from "../database/privilegeCatalog.js";

const Privileges = db.Privileges;
const RolePrivileges = db.RolePrivileges;
const Roles = db.Roles;

/** Cache: normalized role name → privilege codes[] */
let rolePrivilegeCache = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30 * 1000;

export function invalidatePrivilegeCache() {
  rolePrivilegeCache = null;
  cacheLoadedAt = 0;
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

async function loadRolePrivilegeMap() {
  if (
    rolePrivilegeCache &&
    Date.now() - cacheLoadedAt < CACHE_TTL_MS
  ) {
    return rolePrivilegeCache;
  }

  const map = new Map();
  if (!Privileges || !RolePrivileges || !Roles) {
    rolePrivilegeCache = map;
    cacheLoadedAt = Date.now();
    return map;
  }

  const roles = await Roles.findAll({ attributes: ["id", "role_name"] });
  const links = await RolePrivileges.findAll({
    attributes: ["role_id", "privilege_id"],
  });
  const privileges = await Privileges.findAll({
    attributes: ["id", "code"],
  });

  const codeById = new Map(privileges.map((p) => [Number(p.id), p.code]));
  const roleNameById = new Map(
    roles.map((r) => [Number(r.id), String(r.role_name || "").trim()])
  );

  for (const link of links) {
    const roleName = roleNameById.get(Number(link.role_id));
    const code = codeById.get(Number(link.privilege_id));
    if (!roleName || !code) continue;
    const key = normalizeRole(roleName);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(code);
  }

  // Alias keys point at same sets
  for (const [alias, seedKey] of Object.entries(ROLE_NAME_ALIASES || {})) {
    const target = normalizeRole(seedKey);
    if (map.has(target) && !map.has(alias)) {
      map.set(alias, map.get(target));
    }
  }

  rolePrivilegeCache = map;
  cacheLoadedAt = Date.now();
  return map;
}

/** Fallback when DB has no mapping yet for a role */
function fallbackCodesForRole(roleName) {
  const seedKey = resolveSeedRoleKey(roleName);
  const list = DEFAULT_ROLE_PRIVILEGES[seedKey] || DEFAULT_ROLE_PRIVILEGES.default || [];
  return list;
}

export async function getPrivilegeCodesForRoles(roleNames = []) {
  const map = await loadRolePrivilegeMap();
  const codes = new Set();
  for (const raw of roleNames || []) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = normalizeRole(name);
    const fromDb = map.get(key);
    if (fromDb && fromDb.size) {
      for (const code of fromDb) codes.add(code);
      continue;
    }
    // try seed alias key as stored role_name
    const seedKey = resolveSeedRoleKey(name);
    const aliased = map.get(normalizeRole(seedKey));
    if (aliased && aliased.size) {
      for (const code of aliased) codes.add(code);
      continue;
    }
    for (const code of fallbackCodesForRole(name)) codes.add(code);
  }
  return [...codes];
}

export function userHasPrivilege(userOrCodes, privilegeCode) {
  const code = String(privilegeCode || "").trim();
  if (!code) return false;
  if (Array.isArray(userOrCodes)) return userOrCodes.includes(code);
  const list = userOrCodes?.privilege_codes;
  if (Array.isArray(list)) return list.includes(code);
  return false;
}

export async function attachPrivileges(userPlain) {
  if (!userPlain) return userPlain;
  const roles = Array.isArray(userPlain.effective_roles)
    ? userPlain.effective_roles
    : [userPlain.role, ...(userPlain.acting_roles || [])].filter(Boolean);
  const privilege_codes = await getPrivilegeCodesForRoles(roles);
  userPlain.privilege_codes = privilege_codes;
  return userPlain;
}

export async function listPrivileges() {
  return Privileges.findAll({
    order: [
      ["category", "ASC"],
      ["sort_order", "ASC"],
      ["name", "ASC"],
    ],
  });
}

export async function getRolePrivilegeMatrix() {
  const roles = await Roles.findAll({ order: [["role_name", "ASC"]] });
  const privileges = await listPrivileges();
  const links = await RolePrivileges.findAll({
    attributes: ["role_id", "privilege_id"],
  });
  const byRole = new Map();
  for (const link of links) {
    const rid = Number(link.role_id);
    if (!byRole.has(rid)) byRole.set(rid, new Set());
    byRole.get(rid).add(Number(link.privilege_id));
  }
  return {
    roles: roles.map((role) => ({
      id: role.id,
      role_name: role.role_name,
      description: role.description,
      privilege_ids: [...(byRole.get(Number(role.id)) || [])],
    })),
    privileges: privileges.map((p) => p.toJSON()),
  };
}

export async function setRolePrivileges(roleId, privilegeIds = []) {
  const role = await Roles.findByPk(roleId);
  if (!role) return null;
  const ids = [
    ...new Set(
      (Array.isArray(privilegeIds) ? privilegeIds : [])
        .map(Number)
        .filter((id) => id > 0)
    ),
  ];
  await RolePrivileges.destroy({ where: { role_id: roleId } });
  if (ids.length) {
    const valid = await Privileges.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id"],
    });
    await RolePrivileges.bulkCreate(
      valid.map((p) => ({
        role_id: Number(roleId),
        privilege_id: Number(p.id),
      }))
    );
  }
  invalidatePrivilegeCache();
  return getRolePrivilegeMatrix();
}

export async function reseedRoleDefaults(roleId) {
  const role = await Roles.findByPk(roleId);
  if (!role) return null;
  const seedKey = resolveSeedRoleKey(role.role_name);
  const codes = DEFAULT_ROLE_PRIVILEGES[seedKey] || DEFAULT_ROLE_PRIVILEGES.default || [];
  const privs = await Privileges.findAll({
    where: { code: { [Op.in]: codes } },
    attributes: ["id"],
  });
  return setRolePrivileges(
    roleId,
    privs.map((p) => p.id)
  );
}
