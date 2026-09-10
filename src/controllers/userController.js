import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { hashPassword, generatePassword } from "../utils/password.js";
import { createLog } from "../services/logService.js";
import { canManageUsers, canReviewWorkflow, isAdminRole } from "../utils/roleHelpers.js";
import { createNotification, notifyStaff } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { buildEmployeeAnalysis, buildEmployeesOverview } from "../services/employeeAnalysisService.js";
import Email from "../utils/mailer.js";

const Users = db.Users;
const USER_SAFE = { exclude: ["password", "resetcode"] };

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function assertCanAssignRole(actorRole, targetCurrentRole, nextRole) {
  const next = normalizeRole(nextRole);
  const current = normalizeRole(targetCurrentRole);
  if (!next) return null;
  if (isAdminRole(current) && !isAdminRole(actorRole)) {
    return "Only an administrator can edit admin accounts";
  }
  if (next === "admin" && !isAdminRole(actorRole)) {
    return "Only an administrator can grant Admin access";
  }
  return null;
}

function deletedWhere(showDeleted) {
  return showDeleted ? { deleted: "1" } : { deleted: { [Op.ne]: "1" } };
}

function canViewEmployeeAnalysis(viewer, targetUserId) {
  const viewerId = Number(viewer?.id);
  const targetId = Number(targetUserId);
  if (viewerId === targetId) return true;
  return canManageUsers(viewer?.role) || canReviewWorkflow(viewer?.role);
}

export const getMyEmployeeAnalysis = asyncHandler(async (req, res) => {
  const data = await buildEmployeeAnalysis(req.user.id, req.query);
  if (!data) return fail(res, "User not found", 404);
  return ok(res, data);
});

export const getEmployeesOverview = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role) && !canReviewWorkflow(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  const data = await buildEmployeesOverview(req.query);
  return ok(res, data);
});

export const getEmployeeAnalysis = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  if (!canViewEmployeeAnalysis(req.user, targetId)) {
    return fail(res, "Access denied", 403);
  }
  const data = await buildEmployeeAnalysis(targetId, req.query);
  if (!data) return fail(res, "User not found", 404);
  return ok(res, data);
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req, { page: 1, limit: 50, max: 500 });
  const showDeleted = String(req.query.show_deleted || "0") === "1";
  const where = { ...deletedWhere(showDeleted) };
  const search = String(req.query.search || "").trim();
  if (search) {
    where[Op.or] = [
      { names: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
      { role: { [Op.iLike]: `%${search}%` } },
    ];
  }
  if (req.query.role) where.role = req.query.role;
  if (req.query.department_id) where.department_ID = req.query.department_id;
  if (req.query.active !== undefined && req.query.active !== "") where.active = Number(req.query.active);
  if (String(req.user.role || "").toLowerCase() !== "admin") {
    where.role = where.role || { [Op.ne]: "admin" };
  }

  const { rows, count } = await Users.findAndCountAll({
    where,
    attributes: USER_SAFE,
    include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
    order: [["id", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getOneUser = asyncHandler(async (req, res) => {
  const user = await Users.findByPk(req.params.id, {
    attributes: USER_SAFE,
    include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
  });
  if (!user) return fail(res, "User not found", 404);
  return ok(res, user);
});

export const getUsersByDepartment = asyncHandler(async (req, res) => {
  const users = await Users.findAll({
    where: {
      deleted: { [Op.ne]: "1" },
      department_ID: req.params.deptId,
      active: 1,
      id: { [Op.ne]: req.user.id },
    },
    attributes: ["id", "names", "email", "role", "department_ID"],
    order: [["names", "ASC"]],
  });
  return ok(res, users);
});

export const addUser = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);

  const body = req.body || {};
  if (!body.names || !body.email || !body.role) {
    return fail(res, "names, email, and role are required");
  }
  if (!body.department_ID) return fail(res, "Department is required");

  const roleError = assertCanAssignRole(req.user.role, null, body.role);
  if (roleError) return fail(res, roleError, 403);

  const exists = await Users.findOne({
    where: db.sequelize.where(
      db.sequelize.fn("lower", db.sequelize.col("email")),
      String(body.email).toLowerCase()
    ),
  });
  if (exists && String(exists.deleted) !== "1") {
    return fail(res, "Email already in use");
  }

  const plainPassword = body.password || generatePassword();
  const user = await Users.create({
    names: body.names,
    email: body.email,
    personal_email: body.personal_email || null,
    phone: body.phone || "",
    other_phone: body.other_phone || null,
    gender: body.gender || "",
    image: body.image || null,
    bio: body.bio || null,
    role: body.role,
    department_ID: body.department_ID,
    working_area: body.working_area || null,
    living_district: body.living_district || null,
    dob: body.dob || null,
    nationality: body.nationality || null,
    employee_id_number: body.employee_id_number || null,
    password: await hashPassword(plainPassword),
    active: 0,
    force_deactivated: 0,
    deleted: "0",
    signature_approved: "0",
    allowed_leave_days: body.allowed_leave_days || 0,
  });

  if (body.allowed_leave_days) {
    await db.UserAllowedDays.findOrCreate({
      where: { user_id: user.id, year: new Date().getFullYear() },
      defaults: { allowed_days: Number(body.allowed_leave_days) },
    });
  }

  await createLog(req.user.id, "create_user", `Created user ${user.names} (#${user.id})`);
  await createNotification({
    receiverId: user.id,
    type: "user_created",
    title: "Welcome to RWVCA Portal",
    message: "Your staff account has been created. It stays inactive until you log in and complete your profile (including signature).",
    link: "/profile",
    email: false,
    whatsapp: true,
    emailPayload: buildEmailPayload("user", user, {
      intro: "Your RWVCA staff account has been created successfully.",
      actor: req.user,
      actionRequired: "Log in with the emailed password, complete your profile and signature to activate your account.",
      extras: { action: "created" },
    }),
  });
  await notifyStaff(user, {
    subject: "Welcome to RWVCA Portal - Your Account Has Been Created",
    message: "Your staff account has been created. Please log in and complete your profile to activate it.",
    link: "/profile",
    password: plainPassword,
    email: true,
    whatsapp: false,
  });

  const safe = user.toJSON();
  delete safe.password;
  delete safe.resetcode;
  return created(res, { user: safe, generated_password: body.password ? undefined : plainPassword }, "User created");
});

export const updateUser = asyncHandler(async (req, res) => {
  const isSelf = Number(req.params.id) === Number(req.user.id);
  if (!isSelf && !canManageUsers(req.user.role)) {
    return fail(res, "Access denied", 403);
  }

  const user = await Users.findByPk(req.params.id);
  if (!user || String(user.deleted) === "1") return fail(res, "User not found", 404);

  const body = { ...req.body };
  delete body.password;
  delete body.resetcode;
  delete body.id;
  if (!canManageUsers(req.user.role)) {
    delete body.role;
    delete body.active;
    delete body.force_deactivated;
    delete body.department_ID;
    delete body.deleted;
  } else {
    if (body.role !== undefined) {
      const roleError = assertCanAssignRole(req.user.role, user.role, body.role);
      if (roleError) return fail(res, roleError, 403);
    } else if (isAdminRole(user.role) && !isAdminRole(req.user.role)) {
      return fail(res, "Only an administrator can edit admin accounts", 403);
    }
    if (body.active !== undefined) {
      if (Number(body.active) === 1) {
        body.force_deactivated = 0;
      } else {
        body.active = 0;
        body.force_deactivated = 1;
      }
    }
  }

  await user.update(body);
  await createLog(req.user.id, "update_user", `Updated user #${user.id}`);
  if (canManageUsers(req.user.role) && !isSelf) {
    await createNotification({
      whatsapp: true,
      receiverId: user.id,
      type: "user_updated",
      title: "Your RWVCA Account Has Been Updated",
      message: "Your staff account details were updated by HR. Please review your profile.",
      link: "/dashboard/profile",
      emailPayload: buildEmailPayload("user", user, {
        intro: "Your RWVCA staff account details were updated by HR.",
        actor: req.user,
        actionRequired: "Please log in and review your profile to confirm your information is correct.",
        extras: { action: "updated" },
      }),
    });
  }
  const safe = user.toJSON();
  delete safe.password;
  delete safe.resetcode;
  return ok(res, safe, "User updated");
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const user = await Users.findByPk(req.params.id);
  if (!user) return fail(res, "User not found", 404);
  await user.update({ deleted: "1", active: 0, force_deactivated: 1, deleted_at: new Date() });
  await createLog(req.user.id, "delete_user", `Deleted user #${user.id}`);
  await createNotification({
      whatsapp: true,
    receiverId: user.id,
    type: "account_deactivated",
    title: "Your RWVCA Account Has Been Deactivated",
    message: "Your staff account has been deactivated. Contact HR if this is unexpected.",
    link: "/login",
    emailPayload: buildEmailPayload("user", user, {
      intro: "Your RWVCA staff account has been deactivated.",
      actor: req.user,
      extras: { action: "deactivated" },
    }),
  });
  return ok(res, null, "User deleted");
});

export const restoreUser = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const user = await Users.findByPk(req.params.id);
  if (!user) return fail(res, "User not found", 404);
  await user.update({ deleted: "0", active: 1, force_deactivated: 0, deleted_at: null });
  await createLog(req.user.id, "restore_user", `Restored user #${user.id}`);
  await createNotification({
      whatsapp: true,
    receiverId: user.id,
    type: "account_restored",
    title: "Your RWVCA Account Has Been Reactivated",
    message: "Your staff account has been restored. You can log in again.",
    link: "/login",
    emailPayload: buildEmailPayload("user", user, {
      intro: "Your RWVCA staff account has been reactivated. You may log in again.",
      actor: req.user,
      extras: { action: "restored" },
    }),
  });
  return ok(res, { id: user.id, active: 1 }, "User restored");
});

export const setUserActive = (active) =>
  asyncHandler(async (req, res) => {
    if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
    const user = await Users.findByPk(req.params.id);
    if (!user || String(user.deleted) === "1") return fail(res, "User not found", 404);

    if (active) {
      // Manager activate: unlock login and mark active.
      await user.update({ active: 1, force_deactivated: 0 });
      await createLog(req.user.id, "activate_user", `User #${user.id}`);
      await createNotification({
        whatsapp: true,
        receiverId: user.id,
        type: "account_restored",
        title: "Your RWVCA Account Has Been Activated",
        message: "An administrator activated your staff account. You can use the full system.",
        link: "/dashboard",
        emailPayload: buildEmailPayload("user", user, {
          intro: "Your RWVCA staff account has been activated by an administrator.",
          actor: req.user,
          extras: { action: "activated" },
        }),
      });
      return ok(res, { id: user.id, active: 1, force_deactivated: 0 }, "User activated");
    }

    // Manager deactivate: block login even if profile is complete.
    await user.update({ active: 0, force_deactivated: 1 });
    await createLog(req.user.id, "deactivate_user", `User #${user.id}`);
    await createNotification({
      whatsapp: true,
      receiverId: user.id,
      type: "account_deactivated",
      title: "Your RWVCA Account Has Been Deactivated",
      message: "An administrator deactivated your staff account. You cannot log in until it is reactivated.",
      link: "/login",
      emailPayload: buildEmailPayload("user", user, {
        intro: "Your RWVCA staff account has been deactivated by an administrator.",
        actor: req.user,
        extras: { action: "deactivated" },
      }),
    });
    return ok(res, { id: user.id, active: 0, force_deactivated: 1 }, "User deactivated");
  });

export const setSignatureApproved = (approved) =>
  asyncHandler(async (req, res) => {
    if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
    const user = await Users.findByPk(req.params.id);
    if (!user || String(user.deleted) === "1") return fail(res, "User not found", 404);
    await user.update({ signature_approved: approved ? "1" : "0" });
    await createLog(req.user.id, approved ? "approve_signature" : "reject_signature", `User #${user.id}`);
    const notes = String(req.body.notes || "").trim();
    await createNotification({
      whatsapp: true,
      receiverId: user.id,
      type: approved ? "signature_approved" : "signature_rejected",
      title: approved ? "Your Signature Has Been Approved" : "Your Signature Has Been Rejected",
      message: approved
        ? `Your signature has been approved.${notes ? ` Notes: ${notes}` : ""}`
        : `Your signature was rejected.${notes ? ` Notes: ${notes}` : " Please upload a new signature."}`,
      link: "/dashboard/profile",
      emailPayload: buildEmailPayload("user", user, {
        intro: approved
          ? "Your uploaded signature has been approved by HR."
          : "Your uploaded signature was rejected and needs to be replaced.",
        actor: req.user,
        note: notes,
        actionRequired: approved ? undefined : "Please upload a new signature in your profile settings.",
        extras: { action: approved ? "signature approved" : "signature rejected" },
      }),
    });
    return ok(res, { id: user.id, signature_approved: user.signature_approved }, approved ? "Signature approved" : "Signature rejected");
  });

export const getUserLeaveDays = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role) && Number(req.params.id) !== Number(req.user.id)) {
    return fail(res, "Access denied", 403);
  }
  const items = await db.UserAllowedDays.findAll({
    where: { user_id: req.params.id },
    order: [["year", "DESC"]],
  });
  return ok(res, items);
});

export const saveUserLeaveDays = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const year = Number(req.body.year || new Date().getFullYear());
  const allowed_days = Number(req.body.allowed_days || 0);
  const [row] = await db.UserAllowedDays.findOrCreate({
    where: { user_id: req.params.id, year },
    defaults: { allowed_days },
  });
  if (row.allowed_days !== allowed_days) await row.update({ allowed_days });
  await Users.update({ allowed_leave_days: allowed_days }, { where: { id: req.params.id } });
  return ok(res, row, "Leave days saved");
});

export const deleteUserLeaveDays = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.UserAllowedDays.findOne({
    where: { id: req.params.leaveId, user_id: req.params.id },
  });
  if (!row) return fail(res, "Leave days record not found", 404);
  await row.destroy();
  return ok(res, null, "Leave days removed");
});

export const adminResetPassword = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);

  const user = await Users.findByPk(req.params.id);
  if (!user || String(user.deleted) === "1") return fail(res, "User not found", 404);

  if (isAdminRole(user.role) && !isAdminRole(req.user.role)) {
    return fail(res, "Only an administrator can reset an admin account password", 403);
  }

  const requested = String(req.body?.password || "").trim();
  if (requested && requested.length < 6) {
    return fail(res, "Password must be at least 6 characters");
  }
  const plainPassword = requested || generatePassword();

  await user.update({
    password: await hashPassword(plainPassword),
    resetcode: null,
  });
  await createLog(req.user.id, "admin_reset_password", `Reset password for user #${user.id} (${user.email})`);

  let emailed = false;
  try {
    const mailer = new Email(
      { email: user.email, names: user.names, password: plainPassword },
      {
        message:
          "An administrator reset your RWVCA portal password. Use the temporary password below to sign in, then change it from Profile settings.",
      },
      `${process.env.FRONTEND_URL || "https://rwvca-frontend.vercel.app"}/login`
    );
    mailer.setEmailPayload({
      intro: "An administrator reset your RWVCA portal password.",
      details: [
        { label: "Email", value: user.email },
        { label: "Temporary password", value: plainPassword },
      ],
      actionRequired: "Sign in with this temporary password, then change it in Profile settings.",
    });
    await mailer.sendStrict("Notification", "Your RWVCA password was reset", "Password reset", {
      forceSend: true,
    });
    emailed = true;
  } catch (error) {
    console.error("Admin reset password email failed:", error.message);
  }

  await createNotification({
    receiverId: user.id,
    type: "user_updated",
    title: "Your password was reset",
    message: "An administrator reset your password. Check your email for a temporary password, or contact HR if you did not receive it.",
    link: "/login",
    email: false,
    whatsapp: false,
  });

  return ok(
    res,
    { id: user.id, email: user.email, generated_password: plainPassword, emailed },
    emailed
      ? "Password reset and emailed to the user. Temporary password is also shown once below."
      : "Password reset. Email could not be sent — copy the temporary password and share it securely."
  );
});
