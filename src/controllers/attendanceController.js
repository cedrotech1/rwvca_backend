import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload, fmtDate } from "../services/emailNotificationHelpers.js";
import { requireNotificationPriority } from "../utils/notificationPriority.js";
import { canManageUsers } from "../utils/roleHelpers.js";

async function loadAttendance(id) {
  return db.Attendance.findByPk(id, {
    include: [
      { model: db.Users, as: "creator", attributes: ["id", "names", "email", "role"] },
      {
        model: db.AttendanceUsers,
        as: "attendance_users_attendance_id",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role", "department_ID"] }],
      },
    ],
  });
}

export const getAttendanceSessions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${req.query.search}%` } },
      { location: { [Op.iLike]: `%${req.query.search}%` } },
    ];
  }
  const { rows, count } = await db.Attendance.findAndCountAll({
    where,
    include: [{ model: db.Users, as: "creator", attributes: ["id", "names", "email"] }],
    order: [["attendance_date", "DESC"]],
    limit,
    offset,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getAttendanceSession = asyncHandler(async (req, res) => {
  const row = await loadAttendance(req.params.id);
  if (!row) return fail(res, "Attendance session not found", 404);
  return ok(res, row);
});

export const createAttendanceSession = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.title || !req.body.attendance_date) return fail(res, "title and attendance_date are required");
  const row = await db.Attendance.create({
    title: req.body.title,
    description: req.body.description || null,
    type: req.body.type || null,
    location: req.body.location || null,
    attendance_date: req.body.attendance_date,
    created_by: req.user.id,
    status: req.body.status || "active",
  });
  const userIds = Array.isArray(req.body.user_ids) ? req.body.user_ids : [];
  if (userIds.length) {
    const priority = requireNotificationPriority(req.body);
    if (!priority) return fail(res, "Select notification priority (Send as: Urgent / High / Middle / Low)");
    await db.AttendanceUsers.bulkCreate(
      userIds.map((user_id) => ({ attendance_id: row.id, user_id, signed: 0 }))
    );
    await Promise.all(
      userIds.map((user_id) =>
        createNotification({
      whatsapp: true,
          receiverId: user_id,
          type: "attendance",
          title: "Attendance required",
          message: `Please sign attendance for '${row.title}'.`,
          link: `/attendance/${row.id}`,
          priority,
          emailPayload: buildEmailPayload("attendance", row, {
            intro: `${req.user.names} has added you to an attendance session that requires your signature.`,
            actor: req.user,
            actionRequired: "Please sign your attendance for this session at your earliest convenience.",
            extras: {
              details: [
                { label: "Session", value: row.title },
                { label: "Date", value: fmtDate(row.attendance_date) },
                { label: "Location", value: row.location },
                { label: "Type", value: row.type },
                { label: "Description", value: row.description },
              ],
            },
          }),
        })
      )
    );
  }
  await createLog(req.user.id, "create_attendance", `Created attendance #${row.id}`);
  return created(res, await loadAttendance(row.id), "Attendance session created");
});

export const updateAttendanceSession = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Attendance.findByPk(req.params.id);
  if (!row) return fail(res, "Attendance session not found", 404);
  await row.update({
    title: req.body.title || row.title,
    description: req.body.description !== undefined ? req.body.description : row.description,
    type: req.body.type !== undefined ? req.body.type : row.type,
    location: req.body.location !== undefined ? req.body.location : row.location,
    attendance_date: req.body.attendance_date || row.attendance_date,
    status: req.body.status || row.status,
  });
  return ok(res, await loadAttendance(row.id), "Attendance session updated");
});

export const addAttendanceUsers = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Attendance.findByPk(req.params.id);
  if (!row) return fail(res, "Attendance session not found", 404);
  const userIds = Array.isArray(req.body.user_ids) ? req.body.user_ids : [];
  if (!userIds.length) return fail(res, "user_ids is required");
  for (const user_id of userIds) {
    await db.AttendanceUsers.findOrCreate({
      where: { attendance_id: row.id, user_id },
      defaults: { signed: 0 },
    });
  }
  return ok(res, await loadAttendance(row.id), "Users added to attendance");
});

export const signAttendance = asyncHandler(async (req, res) => {
  const row = await db.Attendance.findByPk(req.params.id);
  if (!row) return fail(res, "Attendance session not found", 404);
  const record = await db.AttendanceUsers.findOne({
    where: { attendance_id: row.id, user_id: req.user.id },
  });
  if (!record && !canManageUsers(req.user.role)) return fail(res, "You are not on this attendance list", 403);
  const userId = req.body.user_id && canManageUsers(req.user.role) ? req.body.user_id : req.user.id;
  if (record) {
    await record.update({ signed: 1, responded_at: new Date() });
  } else {
    await db.AttendanceUsers.create({
      attendance_id: row.id,
      user_id: userId,
      signed: 1,
      responded_at: new Date(),
    });
  }
  return ok(res, await loadAttendance(row.id), "Attendance signed");
});

export const deleteAttendanceSession = asyncHandler(async (req, res) => {
  if (!canManageUsers(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Attendance.findByPk(req.params.id);
  if (!row) return fail(res, "Attendance session not found", 404);
  await db.AttendanceUsers.destroy({ where: { attendance_id: row.id } });
  await row.destroy();
  return ok(res, null, "Attendance session deleted");
});
