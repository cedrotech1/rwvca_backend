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

export async function buildRequisitionAnalytics(query = {}) {
  const year = Number(query.year) || new Date().getFullYear();
  const userId = query.user_id ? Number(query.user_id) : null;
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const where = { created_at: { [Op.between]: [from, to] } };
  if (userId) where.prepared_by = userId;

  const rows = await db.Requisitions.findAll({
    where,
    include: [
      { model: db.Users, as: "preparer", attributes: ["id", "names", "role"] },
      { model: db.Department, as: "department", attributes: ["id", "name"] },
    ],
    order: [["created_at", "DESC"]],
    limit: 500,
  });

  let amountTotal = 0;
  const requesterMap = {};
  rows.forEach((row) => {
    const amount = Number(row.total_amount_requested || 0);
    amountTotal += amount;
    const name = row.preparer?.names || "Unknown";
    if (!requesterMap[name]) {
      requesterMap[name] = { label: name, user_id: row.prepared_by, value: 0, amount: 0, pending: 0, approved: 0 };
    }
    requesterMap[name].value += 1;
    requesterMap[name].amount += amount;
    const status = String(row.status || "").toLowerCase();
    if (status.includes("pending")) requesterMap[name].pending += 1;
    if (status.includes("approved") || status.includes("authoriz")) requesterMap[name].approved += 1;
  });

  const pendingAmount = rows
    .filter((row) => String(row.status || "").toLowerCase().includes("pending"))
    .reduce((sum, row) => sum + Number(row.total_amount_requested || 0), 0);
  const approvedAmount = rows
    .filter((row) => {
      const status = String(row.status || "").toLowerCase();
      return status.includes("approved") || status.includes("authoriz");
    })
    .reduce((sum, row) => sum + Number(row.total_amount_requested || 0), 0);

  let monthly = [];
  try {
    monthly = await db.Requisitions.findAll({
      attributes: [
        [sequelize.fn("date_trunc", "month", sequelize.col("created_at")), "month"],
        [sequelize.fn("count", sequelize.col("id")), "count"],
        [sequelize.fn("coalesce", sequelize.fn("sum", sequelize.col("total_amount_requested")), 0), "amount"],
      ],
      where,
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
      requisitions: rows.length,
      pending: countMap(rows, (row) => row.status).find((item) => String(item.label).toLowerCase().includes("pending"))?.value || 0,
      amount_total: amountTotal,
      amount_pending: pendingAmount,
      amount_approved: approvedAmount,
      requesters: Object.keys(requesterMap).length,
    },
    by_status: countMap(rows, (row) => row.status || "Unknown"),
    by_finance_status: countMap(rows, (row) => row.finance_status || "Not set"),
    by_department: countMap(rows, (row) => row.department?.name || "Unassigned").slice(0, 12),
    top_requesters: Object.values(requesterMap).sort((a, b) => b.amount - a.amount).slice(0, 12),
    trends: monthly.map((row) => ({
      month: row.month,
      count: Number(row.count || 0),
      amount: Number(row.amount || 0),
    })),
    recent: rows.slice(0, 20).map((row) => ({
      id: row.id,
      status: row.status,
      finance_status: row.finance_status,
      total_amount_requested: row.total_amount_requested,
      preparer: row.preparer?.names || "—",
      department: row.department?.name || "—",
      created_at: row.created_at,
    })),
  };
}
