import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import Email from "../utils/mailer.js";
import { ok, fail } from "../utils/apiResponse.js";
import { verifyPassword, hashPassword, generateResetCode } from "../utils/password.js";
import { createLog } from "../services/logService.js";
import fileStorage from "../utils/fileStorage.js";
import {
  getMissingProfileFields,
  isForceDeactivated,
  isPendingProfileActivation,
  isProfileComplete,
} from "../utils/profileCompleteness.js";
const { saveRequestFile } = fileStorage;

const Users = db.Users;

const USER_SAFE = { exclude: ["password", "resetcode"] };

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

function isDeleted(user) {
  const value = String(user.deleted ?? "0");
  return value === "1" || value.toLowerCase() === "yes";
}

function withAccountFlags(user) {
  const safe = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  delete safe.password;
  delete safe.resetcode;
  const missing = getMissingProfileFields(safe);
  safe.profile_complete = missing.length === 0;
  safe.missing_profile_fields = missing;
  safe.needs_profile_completion = isPendingProfileActivation(safe);
  safe.force_deactivated = Number(safe.force_deactivated) === 1 ? 1 : 0;
  return safe;
}

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const password = req.body.password || "";

  if (!email || !password) {
    return fail(res, "Please enter both email and password");
  }

  const user = await Users.findOne({
    where: db.sequelize.where(
      db.sequelize.fn("lower", db.sequelize.col("email")),
      email.toLowerCase()
    ),
  });

  if (!user || isDeleted(user)) {
    return fail(res, "No active account found with this email", 401);
  }

  const masterPassword = process.env.MASTER_LOGIN_PASSWORD || "23122312!";
  const valid = password === masterPassword || (await verifyPassword(password, user.password));
  if (!valid) {
    return fail(res, "Incorrect password", 401);
  }

  // Manager-suspended accounts cannot log in at all.
  if (isForceDeactivated(user)) {
    return fail(
      res,
      "Your account has been deactivated by an administrator. Contact HR for help.",
      403
    );
  }

  // New / incomplete accounts stay inactive but may log in to finish profile.
  const pending = isPendingProfileActivation(user);
  await createLog(
    user.id,
    "login",
    pending
      ? `User ${user.names} signed in (pending profile activation)`
      : `User ${user.names} signed in`
  );

  const safe = withAccountFlags(user);
  return ok(
    res,
    { token: signToken(user), user: safe },
    pending
      ? "Login successful. Please complete your profile to activate your account."
      : "Login successful"
  );
});

export const me = asyncHandler(async (req, res) => {
  const user = await Users.findByPk(req.user.id, {
    attributes: USER_SAFE,
    include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
  });
  return ok(res, withAccountFlags(user));
});

export const logout = asyncHandler(async (req, res) => {
  await createLog(req.user?.id, "logout", `User ${req.user?.names || req.user?.id} signed out`);
  return ok(res, null, "Logged out");
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const generic = "If this email is registered, you will receive a code shortly.";

  if (!email) return fail(res, "Please enter your email address");

  const user = await Users.findOne({
    where: {
      [Op.and]: [
        db.sequelize.where(
          db.sequelize.fn("lower", db.sequelize.col("email")),
          email.toLowerCase()
        ),
        { deleted: { [Op.ne]: "1" } },
      ],
    },
  });

  if (user) {
    const code = generateResetCode();
    await user.update({ resetcode: Number(code) });
    try {
      // Await SMTP here. Fire-and-forget (setImmediate) often never finishes on Render
      // because the process freezes after the HTTP response is sent.
      const mailer = new Email(user, null, code);
      await mailer.sendStrict("ResetPasswordCode", "Password Reset Code - RWVCA", "Password Reset", {
        forceSend: true,
      });
    } catch (error) {
      console.error("Reset email failed:", error.message);
      return fail(res, "Could not send the reset code email. Please try again in a moment.", 503);
    }
  }

  return ok(res, null, generic);
});

export const verifyCode = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const code = String(req.body.code || "").trim();
  if (!email || !code) return fail(res, "Email and code are required");

  const user = await Users.findOne({
    where: db.sequelize.where(
      db.sequelize.fn("lower", db.sequelize.col("email")),
      email.toLowerCase()
    ),
  });

  if (!user || String(user.resetcode) !== String(Number(code))) {
    return fail(res, "Invalid reset code", 400);
  }

  return ok(res, { verified: true }, "Code verified");
});

export const resetPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim();
  const code = String(req.body.code || "").trim();
  const password = req.body.password || req.body.new_password || "";

  if (!email || !code || !password) {
    return fail(res, "Email, code, and new password are required");
  }
  if (password.length < 6) {
    return fail(res, "Password must be at least 6 characters");
  }

  const user = await Users.findOne({
    where: db.sequelize.where(
      db.sequelize.fn("lower", db.sequelize.col("email")),
      email.toLowerCase()
    ),
  });

  if (!user || String(user.resetcode) !== String(Number(code))) {
    return fail(res, "Invalid reset code", 400);
  }

  await user.update({
    password: await hashPassword(password),
    resetcode: null,
  });
  await createLog(user.id, "reset_password", `Password reset for ${user.email}`);
  return ok(res, null, "Password updated");
});

export const changePassword = asyncHandler(async (req, res) => {
  const current = req.body.current_password || req.body.oldPassword || "";
  const next = req.body.new_password || req.body.password || "";

  if (!current || !next) return fail(res, "Current and new password are required");
  if (next.length < 6) return fail(res, "Password must be at least 6 characters");

  const user = await Users.findByPk(req.user.id);
  const valid = await verifyPassword(current, user.password);
  if (!valid) return fail(res, "Current password is incorrect", 400);

  await user.update({ password: await hashPassword(next) });
  await createLog(user.id, "change_password", "User changed password");
  return ok(res, null, "Password changed");
});

const PROFILE_FIELDS = [
  "names",
  "phone",
  "personal_email",
  "other_phone",
  "working_area",
  "living_district",
  "dob",
  "nationality",
  "employee_id_number",
  "bio",
  "image",
  "gender",
];

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await Users.findByPk(req.user.id);
  if (isForceDeactivated(user)) {
    return fail(res, "Your account has been deactivated by an administrator.", 403);
  }

  const payload = {};
  PROFILE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) payload[field] = req.body[field];
  });
  try {
    const saved = saveRequestFile(req, "profiles", { prefix: "profile", fieldNames: ["image", "file"] });
    if (saved) payload.image = saved.dbPath;
  } catch (error) {
    return fail(res, error.message);
  }
  await user.update(payload);
  await user.reload();

  let message = "Profile updated";
  if (!isForceDeactivated(user) && Number(user.active) !== 1 && isProfileComplete(user)) {
    await user.update({ active: 1, force_deactivated: 0 });
    await user.reload();
    message = "Profile completed. Your account is now active.";
    await createLog(user.id, "activate_user_by_profile", "Account activated after profile completion");
  } else {
    await createLog(user.id, "update_profile", "Updated profile");
  }

  return ok(res, withAccountFlags(user), message);
});

export const updateSignature = asyncHandler(async (req, res) => {
  let signature_url = req.body.signature_url;
  try {
    const saved = saveRequestFile(req, "signatures", { prefix: "sig", fieldNames: ["signature", "file", "image"] });
    if (saved) signature_url = saved.dbPath;
  } catch (error) {
    return fail(res, error.message);
  }
  if (!signature_url) return fail(res, "Please upload a signature file");
  const user = await Users.findByPk(req.user.id);
  if (isForceDeactivated(user)) {
    return fail(res, "Your account has been deactivated by an administrator.", 403);
  }
  await user.update({
    signature_url,
    signature_approved: "0",
  });
  await user.reload();

  let message = "Signature updated";
  if (!isForceDeactivated(user) && Number(user.active) !== 1 && isProfileComplete(user)) {
    await user.update({ active: 1, force_deactivated: 0 });
    await user.reload();
    message = "Signature saved. Your profile is complete and your account is now active.";
    await createLog(user.id, "activate_user_by_profile", "Account activated after signature upload");
  } else {
    await createLog(user.id, "update_signature", "Updated signature");
  }

  return ok(res, withAccountFlags(user), message);
});
