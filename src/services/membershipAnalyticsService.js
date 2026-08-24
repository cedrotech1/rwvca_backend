import { Op } from "sequelize";
import db from "../database/models/index.js";

const sequelize = db.sequelize;

function countMap(rows, keyFn) {
  const map = {};
  rows.forEach((row) => {
    const key = keyFn(row) || "Unknown";
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export async function buildMembershipAnalytics(query = {}) {
  const year = Number(query.year) || new Date().getFullYear();
  const search = String(query.search || "").trim();
  const reportType = String(query.report_type || "").trim().toUpperCase();
  const userId = query.user_id ? Number(query.user_id) : null;
  const mineOnly = String(query.mine || "") === "1";

  const where = { year };
  if (reportType) where.report_type = reportType;
  if (userId) where[Op.or] = [{ user_id: userId }, { submitted_by: userId }];
  if (search) where.title = { [Op.iLike]: `%${search}%` };

  const reports = await db.MembershipReports.findAll({
    where,
    include: [
      { model: db.Users, as: "user", attributes: ["id", "names", "role"] },
      { model: db.MembershipReportPayments, as: "payments", attributes: ["amount", "method"], required: false },
    ],
    order: [["created_at", "DESC"]],
    limit: 500,
  });

  let amountTotal = 0;
  const methodMap = {};
  const officerMap = {};

  reports.forEach((row) => {
    const officerName = row.user?.names || "Unknown";
    if (!officerMap[officerName]) {
      officerMap[officerName] = { label: officerName, user_id: row.user_id, value: 0, pending: 0, approved: 0, amount: 0 };
    }
    officerMap[officerName].value += 1;
    if (String(row.status).toUpperCase() === "PENDING") officerMap[officerName].pending += 1;
    if (String(row.status).toUpperCase() === "APPROVED") officerMap[officerName].approved += 1;
    (row.payments || []).forEach((pay) => {
      const amount = Number(pay.amount || 0);
      amountTotal += amount;
      officerMap[officerName].amount += amount;
      const method = pay.method || "Unknown";
      methodMap[method] = (methodMap[method] || 0) + amount;
    });
  });

  const byStatus = countMap(reports, (row) => row.status || "Unknown");
  const byType = countMap(reports, (row) => row.report_type || "Unknown");
  const byLocation = countMap(reports, (row) => row.location || "Unspecified").slice(0, 12);
  const topOfficers = Object.values(officerMap).sort((a, b) => b.value - a.value).slice(0, 12);

  let monthly = [];
  try {
    const trendWhere = { year };
    if (mineOnly && userId) trendWhere[Op.or] = [{ user_id: userId }, { submitted_by: userId }];
    monthly = await db.MembershipReports.findAll({
      attributes: [
        [sequelize.fn("date_trunc", "month", sequelize.col("created_at")), "month"],
        [sequelize.fn("count", sequelize.col("id")), "count"],
      ],
      where: trendWhere,
      group: [sequelize.fn("date_trunc", "month", sequelize.col("created_at"))],
      order: [[sequelize.fn("date_trunc", "month", sequelize.col("created_at")), "ASC"]],
      raw: true,
    });
  } catch {
    monthly = [];
  }

  return {
    year,
    summary: {
      reports: reports.length,
      pending: byStatus.find((item) => String(item.label).toUpperCase() === "PENDING")?.value || 0,
      approved: byStatus.find((item) => String(item.label).toUpperCase() === "APPROVED")?.value || 0,
      reverted: byStatus.find((item) => String(item.label).toUpperCase() === "REVERTED")?.value || 0,
      officers: Object.keys(officerMap).length,
      amount_total: amountTotal,
    },
    by_status: byStatus,
    by_type: byType,
    by_location: byLocation,
    by_payment_method: Object.entries(methodMap).map(([label, value]) => ({ label, value: Math.round(value) })),
    top_officers: topOfficers,
    trends: monthly.map((row) => ({ month: row.month, count: Number(row.count || 0) })),
    recent: reports.slice(0, 20).map((row) => ({
      id: row.id,
      title: row.title,
      report_type: row.report_type,
      status: row.status,
      location: row.location,
      officer: row.user?.names || "—",
      created_at: row.created_at,
    })),
  };
}
