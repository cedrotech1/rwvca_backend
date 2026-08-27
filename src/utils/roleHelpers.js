export const ADMIN_ROLES = ["admin", "ed", "chairman"];
/** Roles that share HR operational powers (verify leave/mission, org lists, etc.). */
export const HR_SPECIAL_ROLES = ["hr", "accountant"];
export const HR_ROLES = ["admin", "ed", "hr", "accountant"];
export const FINANCE_ROLES = ["admin", "ed", "accountant", "assistant to the accountant", "finance"];

/** Named staff with full procurement module access (in addition to Procurement Officer). */
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

export const isAdminRole = (role) => ADMIN_ROLES.includes(normalize(role));
export const isHrRole = (role) => HR_ROLES.includes(normalize(role));
export const isFinanceRole = (role) => FINANCE_ROLES.includes(normalize(role));

/** True for HR and Accountant — both can perform HR special workflow actions. */
export const hasHrSpecialAccess = (role) => HR_SPECIAL_ROLES.includes(normalize(role));

export const canManageUsers = (role) => isAdminRole(role) || hasHrSpecialAccess(role);

/**
 * Historical name kept for call sites: means "has HR special powers".
 * Includes Accountant so they can do everything HR can do.
 */
export const isExactHr = (role) => hasHrSpecialAccess(role);

export const isEdRole = (role) => normalize(role) === "ed";
export const isChairmanRole = (role) => normalize(role) === "chairman";
export const isExecutiveRole = (role) => isEdRole(role) || isChairmanRole(role);
export const isDirectApplicant = (role) => isExecutiveRole(role);
export const canReviewWorkflow = (role) =>
  hasHrSpecialAccess(role) || isAdminRole(role) || isExecutiveRole(role);

export const isLogisticRole = (role) => {
  const value = normalize(role);
  return value === "membership coordinator" || value === "logistic" || value === "admin";
};

export const canManageAssets = (role) => {
  const value = normalize(role);
  return value === "membership coordinator" || value === "logistic";
};

export const canManageInventory = (role) => {
  const value = normalize(role);
  return value === "membership coordinator" || value === "logistic" || value === "ed" || value === "chairman";
};

export const isAccountantRole = (role) => {
  const value = normalize(role);
  return value === "accountant" || value === "assistant to the accountant" || value === "assistant to ed";
};

export const isProcurementOfficer = (role) => {
  const value = normalize(role);
  return value === "procurement officer" || value === "procurement";
};

export const hasProcurementEmailAccess = (user) =>
  PROCUREMENT_FULL_ACCESS_EMAILS.includes(normalizeEmail(user?.email));

/** Can open procurement dashboard / read stats and records. */
export const canAccessProcurement = (user) => {
  if (!user) return false;
  if (hasProcurementEmailAccess(user)) return true;
  return PROCUREMENT_ACCESS_ROLES.includes(normalize(user.role));
};

/**
 * Can create / update / delete procurement records and documents.
 * Procurement Officer is the primary manager; the three named staff also have full access.
 */
export const canManageProcurement = (user) => {
  if (!user) return false;
  if (isProcurementOfficer(user.role)) return true;
  if (hasProcurementEmailAccess(user)) return true;
  return isAdminRole(user.role);
};

export const canManageMembers = (role) => {
  const value = normalize(role);
  return [
    "ed",
    "chairman",
    "admin",
    "membership coordinator",
    "membership_officer",
    "membership officer",
    "logistic",
    "membership r. supervisor",
  ].includes(value);
};
