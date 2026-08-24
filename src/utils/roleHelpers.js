export const ADMIN_ROLES = ["admin", "ed", "chairman"];
export const HR_ROLES = ["admin", "ed", "hr"];
export const FINANCE_ROLES = ["admin", "ed", "accountant", "assistant to the accountant", "finance"];

const normalize = (role) => String(role || "").trim().toLowerCase();

export const isAdminRole = (role) => ADMIN_ROLES.includes(normalize(role));
export const isHrRole = (role) => HR_ROLES.includes(normalize(role));
export const isFinanceRole = (role) => FINANCE_ROLES.includes(normalize(role));

export const canManageUsers = (role) => isAdminRole(role) || normalize(role) === "hr";

export const isExactHr = (role) => normalize(role) === "hr";
export const isEdRole = (role) => normalize(role) === "ed";
export const isChairmanRole = (role) => normalize(role) === "chairman";
export const isExecutiveRole = (role) => isEdRole(role) || isChairmanRole(role);
export const isDirectApplicant = (role) => isExecutiveRole(role);
export const canReviewWorkflow = (role) =>
  isExactHr(role) || isAdminRole(role) || isExecutiveRole(role);

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
