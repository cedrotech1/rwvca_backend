import { Op } from "sequelize";
import db from "../database/models/index.js";

/**
 * Leave must fall fully inside a pre-submitted leave schedule (pending or approved).
 * Compares schedule from_date/return_date with request leave_from/return_date only — no schema changes.
 */
export async function findCoveringLeaveSchedule(userId, leaveFrom, returnDate) {
  const from = String(leaveFrom || "").slice(0, 10);
  const to = String(returnDate || "").slice(0, 10);
  if (!from || !to) return null;

  return db.LeaveSchedule.findOne({
    where: {
      user_id: userId,
      status: { [Op.in]: ["pending", "approved"] },
      from_date: { [Op.lte]: from },
      return_date: { [Op.gte]: to },
    },
    order: [
      [db.sequelize.literal("CASE WHEN status = 'approved' THEN 0 ELSE 1 END"), "ASC"],
      ["created_at", "DESC"],
    ],
  });
}

export async function assertLeaveScheduleCoverage(userId, leaveFrom, returnDate) {
  const schedule = await findCoveringLeaveSchedule(userId, leaveFrom, returnDate);
  if (!schedule) {
    const err = new Error(
      "Leave Schedule Restriction: You must pre-schedule your leave before submitting a request. " +
        "Create a leave schedule that fully covers your requested dates, then submit your leave request."
    );
    err.statusCode = 400;
    throw err;
  }
  return schedule;
}

export function scheduleCoverageMessage(schedule) {
  if (!schedule) return null;
  return `Covered by leave schedule #${schedule.id} (${schedule.from_date} to ${schedule.return_date}, ${schedule.status}).`;
}
