import { Op } from "sequelize";
import db from "../database/models/index.js";

export async function getLeaveBalance(userId) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const allowedRows = await db.UserAllowedDays.findAll({
    where: { user_id: userId },
    order: [["year", "DESC"]],
  });
  const currentAllowed = Number(allowedRows.find((row) => row.year === currentYear)?.allowed_days || 0);
  const previousAllowed = Number(allowedRows.find((row) => row.year === previousYear)?.allowed_days || 0);

  const allRequests = await db.LeaveRequests.findAll({
    where: {
      user_id: userId,
      leave_requests_status: { [Op.notIn]: ["reverted", "rejected"] },
    },
    order: [["created_at", "ASC"]],
  });

  let totalCarryOverUsed = 0;
  let totalCurrentYearUsed = 0;
  allRequests.forEach((req) => {
    totalCarryOverUsed += Number(req.carry_over_days_used || 0);
    totalCurrentYearUsed += Number(req.current_year_days_used || 0);
  });

  const previousYearUsed = allRequests
    .filter((req) => req.year === previousYear)
    .reduce((sum, req) => sum + Number(req.requested_days || 0), 0);

  if (totalCarryOverUsed === 0 && totalCurrentYearUsed === 0) {
    let remainingCarry = Math.max(0, previousAllowed - previousYearUsed);
    allRequests
      .filter((req) => req.year === currentYear)
      .forEach((req) => {
        const days = Number(req.requested_days || 0);
        const fromCarry = Math.min(days, remainingCarry);
        totalCarryOverUsed += fromCarry;
        remainingCarry -= fromCarry;
        totalCurrentYearUsed += days - fromCarry;
      });
  }

  const carryOverAvailable = Math.max(0, previousAllowed - previousYearUsed);
  const carryOverRemaining = Math.max(0, carryOverAvailable - totalCarryOverUsed);
  const currentRemaining = Math.max(0, currentAllowed - totalCurrentYearUsed);

  return {
    current_year: currentYear,
    previous_year: previousYear,
    current_allowed: currentAllowed,
    previous_allowed: previousAllowed,
    carry_over_available: carryOverAvailable,
    carry_over_used: totalCarryOverUsed,
    carry_over_remaining: carryOverRemaining,
    current_year_used: totalCurrentYearUsed,
    current_remaining: currentRemaining,
    total_available_days: carryOverRemaining + currentRemaining,
  };
}

export async function getLeaveBalancesMap(userIds = []) {
  const unique = [...new Set(userIds.map(Number).filter(Boolean))];
  const entries = await Promise.all(unique.map(async (id) => [id, await getLeaveBalance(id)]));
  return Object.fromEntries(entries);
}
