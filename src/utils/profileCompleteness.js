/**
 * Required fields a staff member must complete before the account auto-activates.
 */
export const REQUIRED_PROFILE_FIELDS = [
  "names",
  "phone",
  "gender",
  "living_district",
  "dob",
  "nationality",
  "employee_id_number",
  "image",
  "signature_url",
];

export function isFilled(value) {
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
}

export function getMissingProfileFields(user = {}) {
  return REQUIRED_PROFILE_FIELDS.filter((field) => !isFilled(user[field]));
}

export function isProfileComplete(user = {}) {
  return getMissingProfileFields(user).length === 0;
}

export function isForceDeactivated(user = {}) {
  return Number(user.force_deactivated) === 1;
}

export function isAccountActive(user = {}) {
  return Number(user.active) === 1 && !isForceDeactivated(user);
}

/** Inactive only because profile is still incomplete (not manager-suspended). */
export function isPendingProfileActivation(user = {}) {
  return !isForceDeactivated(user) && Number(user.active) !== 1;
}
