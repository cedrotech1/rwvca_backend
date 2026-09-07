import { Op } from "sequelize";
import db from "../database/models/index.js";

const sequelize = db.sequelize;

const REPORT_TYPES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];

const MEMBERSHIP_FEE_METHODS = new Set([
  "MEMBERSHIP_FEES_REGISTRETION",
  "MEMBERSHIP_FEES_REGISTRATION",
  "MEMBERSHIP_FEES_CONTRIBUTION",
]);

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

function toNumber(value) {
  if (value == null || value === "") return 0;
  const amount = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(amount) ? 0 : amount;
}

function isMembershipFeeMethod(method) {
  return MEMBERSHIP_FEE_METHODS.has(String(method || "").trim().toUpperCase());
}

/** Same period/location filters as /membership-reports list page. */
function applyAnalyticsFilters(where, query = {}) {
  const reportType = String(query.report_type || "").trim().toUpperCase();
  const location = String(query.location || "").trim();
  const startDate = String(query.start_date || query.daily_date || "").trim();
  const endDate = String(query.end_date || "").trim();
  const monthlyMonth = String(query.monthly_month || query.month_name || "").trim();
  const yearlyYear = String(query.yearly_year || "").trim();
  const quarter = String(query.quarter || "").trim();
  const search = String(query.search || "").trim();
  const year = query.year ? Number(query.year) : null;

  if (REPORT_TYPES.includes(reportType)) where.report_type = reportType;
  if (query.status) where.status = String(query.status).toUpperCase();
  if (location && location.toLowerCase() !== "all" && location.toLowerCase() !== "all locations") {
    where.location = location;
  }

  switch (reportType) {
    case "DAILY":
      if (startDate) where.start_date = startDate;
      break;
    case "WEEKLY":
      if (startDate) where.start_date = { [Op.gte]: startDate };
      if (endDate) where.end_date = { [Op.lte]: endDate };
      break;
    case "MONTHLY":
      if (monthlyMonth) where.monthly_month = monthlyMonth;
      if (yearlyYear) where.yearly_year = yearlyYear;
      break;
    case "QUARTERLY":
      if (quarter) where.quarter = quarter;
      if (yearlyYear) where.yearly_year = yearlyYear;
      break;
    case "YEARLY":
      if (yearlyYear) where.yearly_year = yearlyYear;
      break;
    default:
      if (startDate && endDate) {
        where.created_at = {
          [Op.between]: [new Date(`${startDate}T00:00:00`), new Date(`${endDate}T23:59:59`)],
        };
      } else if (year) {
        where.year = year;
      }
      break;
  }

  if (search) where.title = { [Op.iLike]: `%${search}%` };
  return where;
}

export async function buildMembershipAnalytics(query = {}) {
  const search = String(query.search || "").trim();
  const reportType = String(query.report_type || "").trim().toUpperCase();
  const location = String(query.location || "").trim();
  const userId = query.user_id ? Number(query.user_id) : null;
  const mineOnly = String(query.mine || "") === "1";
  const year = Number(query.year || query.yearly_year) || new Date().getFullYear();

  const where = {};
  applyAnalyticsFilters(where, query);

  if (userId) {
    const access = { [Op.or]: [{ user_id: userId }, { submitted_by: userId }] };
    if (where[Op.or]) {
      where[Op.and] = [{ [Op.or]: where[Op.or] }, access];
      delete where[Op.or];
    } else {
      Object.assign(where, access);
    }
  }

  const reports = await db.MembershipReports.findAll({
    where,
    include: [
      { model: db.Users, as: "user", attributes: ["id", "names", "role", "working_area"] },
      { model: db.MembershipReportPayments, as: "payments", attributes: ["amount", "method"], required: false },
      {
        model: db.MembershipReportItems,
        as: "items",
        attributes: ["timber_name", "category", "number_of_timber", "vat", "total_cost", "msf", "mst"],
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
    limit: 1000,
  });

  let totalTimber = 0;
  let totalVat = 0;
  let totalMembershipFees = 0;
  let weeklyReports = 0;
  let monthlyReports = 0;
  const methodMap = {};
  const timberTypeMap = {};
  const officerMap = {};

  reports.forEach((row) => {
    const type = String(row.report_type || "").toUpperCase();
    if (type === "WEEKLY") weeklyReports += 1;
    if (type === "MONTHLY") monthlyReports += 1;

    const officerName = row.user?.names || "Unknown";
    const officerLocation = row.location || row.user?.working_area || "Unspecified";
    const officerKey = `${row.user_id || officerName}::${officerLocation}`;
    if (!officerMap[officerKey]) {
      officerMap[officerKey] = {
        label: `${officerName} (${officerLocation})`,
        names: officerName,
        location: officerLocation,
        user_id: row.user_id,
        value: 0,
        pending: 0,
        approved: 0,
        timber: 0,
        vat: 0,
        membership_fees: 0,
      };
    }
    officerMap[officerKey].value += 1;
    if (String(row.status).toUpperCase() === "PENDING") officerMap[officerKey].pending += 1;
    if (String(row.status).toUpperCase() === "APPROVED") officerMap[officerKey].approved += 1;

    (row.items || []).forEach((item) => {
      const qty = toNumber(item.number_of_timber);
      const vat = toNumber(item.vat);
      totalTimber += qty;
      totalVat += vat;
      officerMap[officerKey].timber += qty;
      officerMap[officerKey].vat += vat;

      const timberName = String(item.timber_name || "Unknown").trim() || "Unknown";
      if (!timberTypeMap[timberName]) {
        timberTypeMap[timberName] = { label: timberName, value: 0, vat: 0, count: 0 };
      }
      timberTypeMap[timberName].value += qty;
      timberTypeMap[timberName].vat += vat;
      timberTypeMap[timberName].count += 1;
    });

    (row.payments || []).forEach((pay) => {
      const amount = toNumber(pay.amount);
      const method = String(pay.method || "Unknown").trim().toUpperCase() || "Unknown";
      if (isMembershipFeeMethod(method)) {
        totalMembershipFees += amount;
        officerMap[officerKey].membership_fees += amount;
        return;
      }
      methodMap[method] = (methodMap[method] || 0) + amount;
    });
  });

  const byStatus = countMap(reports, (row) => row.status || "Unknown");
  const byType = countMap(reports, (row) => row.report_type || "Unknown");
  const byLocation = countMap(reports, (row) => row.location || "Unspecified");
  const topOfficers = Object.values(officerMap).sort((a, b) => b.value - a.value).slice(0, 12);
  const byTimberType = Object.values(timberTypeMap)
    .map((item) => ({
      label: item.label,
      value: Math.round(item.value * 100) / 100,
      vat: Math.round(item.vat * 100) / 100,
      count: item.count,
    }))
    .sort((a, b) => b.value - a.value);

  let monthly = [];
  try {
    const trendWhere = { ...where };
    if (mineOnly && userId) {
      trendWhere[Op.or] = [{ user_id: userId }, { submitted_by: userId }];
    }
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

  const locations = [...new Set(reports.map((row) => row.location).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return {
    year,
    filters: {
      report_type: reportType || null,
      location: location || null,
      search: search || null,
      start_date: query.start_date || null,
      end_date: query.end_date || null,
      monthly_month: query.monthly_month || null,
      yearly_year: query.yearly_year || null,
      quarter: query.quarter || null,
    },
    summary: {
      reports: reports.length,
      pending: byStatus.find((item) => String(item.label).toUpperCase() === "PENDING")?.value || 0,
      approved: byStatus.find((item) => String(item.label).toUpperCase() === "APPROVED")?.value || 0,
      reverted: byStatus.find((item) => String(item.label).toUpperCase() === "REVERTED")?.value || 0,
      officers: new Set(Object.values(officerMap).map((item) => item.user_id || item.names)).size,
      total_timber: Math.round(totalTimber * 100) / 100,
      weekly_reports: weeklyReports,
      monthly_reports: monthlyReports,
      total_membership_fees: Math.round(totalMembershipFees * 100) / 100,
      total_vat: Math.round(totalVat * 100) / 100,
    },
    by_status: byStatus,
    by_type: byType,
    by_location: byLocation,
    by_timber_type: byTimberType,
    by_payment_method: Object.entries(methodMap)
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value),
    top_officers: topOfficers,
    locations,
    trends: monthly.map((row) => ({ month: row.month, count: Number(row.count || 0) })),
  };
}
