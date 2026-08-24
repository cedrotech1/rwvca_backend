import { Op } from "sequelize";
import db from "../database/models/index.js";
import { isDirectApplicant, isEdRole } from "../utils/roleHelpers.js";

const USER_SAFE = ["id", "names", "email", "role", "signature_url", "department_ID", "phone", "employee_id_number"];

export function hasSignature(user) {
  return Boolean(user?.signature_url && String(user.signature_url).trim());
}

export async function findUserByRole(role) {
  return db.Users.findOne({
    where: {
      [Op.and]: [
        db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("role")), String(role).toLowerCase()),
        { deleted: { [Op.ne]: "1" } },
        { active: 1 },
      ],
    },
    attributes: USER_SAFE,
    order: [["id", "ASC"]],
  });
}

export async function getWorkflowOfficers() {
  const [hr, ed, chairman] = await Promise.all([
    findUserByRole("HR"),
    findUserByRole("ED"),
    findUserByRole("Chairman"),
  ]);
  return { hr, ed, chairman };
}

export async function getApproverForApplicant(applicantRole) {
  const { hr, ed, chairman } = await getWorkflowOfficers();
  const direct = isDirectApplicant(applicantRole);
  let executive = ed;
  if (isEdRole(applicantRole) && chairman) {
    executive = chairman;
  }
  return {
    hr: direct ? null : hr,
    executive,
    chairman,
    direct,
  };
}

export const USER_PUBLIC = USER_SAFE;

export function normalizeEdStampChoice(value, fallback = "signature_only") {
  const choice = String(value || "").trim().toLowerCase();
  if (choice === "signature_only" || choice === "stamp_with_signature" || choice === "no") return choice;
  if (choice === "yes" || choice === "stamp") return "stamp_with_signature";
  return fallback;
}
