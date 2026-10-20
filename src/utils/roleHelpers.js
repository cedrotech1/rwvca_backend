import { userHasPrivilege } from "../services/privilegeService.js";

export const ADMIN_ROLES = ["admin", "ed", "chairman"];
export const HR_SPECIAL_ROLES = ["hr", "accountant"];
export const HR_ROLES = ["admin", "ed", "hr", "accountant"];
export const FINANCE_ROLES = [
  "admin",
  "ed",
  "accountant",
  "assistant to the accountant",
  "finance",
];

export const PROCUREMENT_FULL_ACCESS_EMAILS = [
  "gnyirabahizi@rwvca.org.rw",
  "ebizumuremyi@rwvca.org.rw",
  "mukayisenga@rwvca.org.rw",
];

export const PROCUREMENT_ACCESS_ROLES = [
  "procurement officer",
  "procurement",
  "project coordinator",
  "membership coordinator",
  "hr",
  "admin",
  "ed",
  "chairman",
];

const normalize = (role) => String(role || "").trim().toLowerCase();
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export function getEffectiveRoles(roleOrUser) {
  if (roleOrUser && typeof roleOrUser === "object") {
    if (Array.isArray(roleOrUser.effective_roles) && roleOrUser.effective_roles.length) {
      return [
        ...new Set(roleOrUser.effective_roles.map(normalize).filter(Boolean)),
      ];
    }
    const primary = roleOrUser.role;
    const acting = Array.isArray(roleOrUser.acting_roles)
      ? roleOrUser.acting_roles
      : [];
    return [...new Set([primary, ...acting].map(normalize).filter(Boolean))];
  }
  const single = normalize(roleOrUser);
  return single ? [single] : [];
}

export function userHasAnyRole(roleOrUser, allowedRoles = []) {
  const allowed = new Set((allowedRoles || []).map(normalize).filter(Boolean));
  if (!allowed.size) return false;
  return getEffectiveRoles(roleOrUser).some((role) => allowed.has(role));
}

function hasLoadedPrivileges(roleOrUser) {
  return (
    roleOrUser &&
    typeof roleOrUser === "object" &&
    Array.isArray(roleOrUser.privilege_codes)
  );
}

/** Prefer DB privileges on the logged-in user; fall back to role names for other users. */
function hasPrivOrRole(roleOrUser, privilegeCode, fallbackRoles = []) {
  if (hasLoadedPrivileges(roleOrUser)) {
    return userHasPrivilege(roleOrUser, privilegeCode);
  }
  return userHasAnyRole(roleOrUser, fallbackRoles);
}

export const isAdminRole = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "admin.system", ADMIN_ROLES) ||
  (hasLoadedPrivileges(roleOrUser) && userHasAnyRole(roleOrUser, ADMIN_ROLES));

export const isHrRole = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "hr.special", HR_ROLES) ||
  userHasAnyRole(roleOrUser, HR_ROLES);

export const isFinanceRole = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "finance.requisitions.view", FINANCE_ROLES);

export const hasHrSpecialAccess = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "hr.special", HR_SPECIAL_ROLES);

export const canManageUsers = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "users.manage", [
    ...ADMIN_ROLES,
    ...HR_SPECIAL_ROLES,
  ]);

export const canManageRoles = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "roles.manage", [
    ...ADMIN_ROLES,
    ...HR_SPECIAL_ROLES,
  ]);

export const isExactHr = (roleOrUser) => hasHrSpecialAccess(roleOrUser);

export const isEdRole = (roleOrUser) => userHasAnyRole(roleOrUser, ["ed"]);
export const isChairmanRole = (roleOrUser) =>
  userHasAnyRole(roleOrUser, ["chairman"]);
export const isExecutiveRole = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "executive.access", ["ed", "chairman"]);
export const isDirectApplicant = (roleOrUser) => isExecutiveRole(roleOrUser);

export const canReviewWorkflow = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "workflow.review", [
    ...HR_SPECIAL_ROLES,
    ...ADMIN_ROLES,
  ]);

export const isLogisticRole = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "assets.manage", [
    "membership coordinator",
    "logistic",
    "admin",
  ]);

export const canManageAssets = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "assets.manage", [
    "membership coordinator",
    "logistic",
  ]);

export const canManageInventory = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "inventory.manage", [
    "membership coordinator",
    "logistic",
    "ed",
    "chairman",
  ]);

export const isAccountantRole = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "finance.requisitions.view", [
    "accountant",
    "assistant to the accountant",
    "assistant to ed",
  ]);

export const isProcurementOfficer = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "procurement.manage", [
    "procurement officer",
    "procurement",
  ]);

export const hasProcurementEmailAccess = (user) =>
  PROCUREMENT_FULL_ACCESS_EMAILS.includes(normalizeEmail(user?.email));

export const canAccessProcurement = (user) => {
  if (!user) return false;
  if (hasProcurementEmailAccess(user)) return true;
  return hasPrivOrRole(user, "procurement.access", PROCUREMENT_ACCESS_ROLES);
};

export const canManageProcurement = (user) => {
  if (!user) return false;
  if (hasProcurementEmailAccess(user)) return true;
  if (hasLoadedPrivileges(user)) {
    return userHasPrivilege(user, "procurement.manage");
  }
  return isProcurementOfficer(user) || isAdminRole(user);
};

export const canManageMembers = (roleOrUser) =>
  hasPrivOrRole(roleOrUser, "members.manage", [
    "ed",
    "chairman",
    "admin",
    "membership coordinator",
    "membership_officer",
    "membership officer",
    "logistic",
    "membership r. supervisor",
  ]);
