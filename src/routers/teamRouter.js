import { createWebsiteRouter } from "../helpers/websiteCrud.js";
import { hashPassword, generatePassword } from "../utils/password.js";

function sanitizeTeam(row) {
  const data = row.toJSON ? row.toJSON() : { ...row };
  delete data.password;
  delete data.resetcode;
  return data;
}

export default createWebsiteRouter("Team", {
  searchFields: ["names", "email", "role"],
  required: ["names", "email", "phone", "role"],
  statusField: null,
  sanitize: sanitizeTeam,
  defaults: { active: 1, deleted: "no" },
  prepareCreate: async (payload) => ({
    password: await hashPassword(payload.password || generatePassword()),
    active: payload.active === undefined ? 1 : Number(payload.active),
    deleted: payload.deleted || "no",
  }),
  fileField: { folder: "profiles", dbField: "image", prefix: "team" },
  logAction: "team",
});
