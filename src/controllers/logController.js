import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { isAdminRole, canReviewWorkflow } from "../utils/roleHelpers.js";

const FAILED_RE = /fail|error|reject|denied|unauthor/i;
const WARNING_RE = /warn|revert|pending/i;

function canSeeAllLogs(role) {
  return isAdminRole(role) || canReviewWorkflow(role);
}

function logStatus(row) {
  const text = `${row.action || ""} ${row.description || ""}`;
  if (FAILED_RE.test(text)) return "FAILED";
  if (WARNING_RE.test(text)) return "WARNING";
  return "SUCCESS";
}

function logModule(action) {
  const value = String(action || "").toLowerCase();
  if (value.includes("login") || value.includes("logout") || value.includes("auth")) return "Authentication";
  if (value.includes("user") || value.includes("signature")) return "Users";
  if (value.includes("member_product") || value.includes("product")) return "Member Products";
  if (value.includes("member")) return "Members";
  if (value.includes("report")) return "Reports";
  if (value.includes("leave")) return "Leave";
  if (value.includes("event")) return "Events";
  if (value.includes("program")) return "Programs";
  if (value.includes("gallery") || value.includes("ads") || value.includes("partner") || value.includes("team")) return "Website";
  if (value.includes("setting") || value.includes("company")) return "System Settings";
  if (value.includes("requisition")) return "Requisitions";
  if (value.includes("mission")) return "Missions";
  if (value.includes("ticket")) return "Tickets";
  return "System";
}

function decorate(row) {
  const data = row.toJSON ? row.toJSON() : row;
  return {
    ...data,
    status: logStatus(data),
    module: logModule(data.action),
    userName: data.user?.names || "System",
  };
}

function buildWhere(req) {
  const where = {};
  if (!canSeeAllLogs(req.user.role)) {
    where.user_id = req.user.id;
  } else if (req.query.user_id || req.query.userId) {
    where.user_id = req.query.user_id || req.query.userId;
  }

  const search = String(req.query.search || req.query.activity || "").trim();
  if (search) {
    where[Op.or] = [
      { action: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const action = String(req.query.action || "").trim();
  if (action) where.action = { [Op.iLike]: `%${action}%` };

  if (req.query.exactDate) {
    where.created_at = {
      [Op.between]: [`${req.query.exactDate} 00:00:00`, `${req.query.exactDate} 23:59:59`],
    };
  } else {
    if (req.query.startDate || req.query.date_from) {
      const from = req.query.startDate || req.query.date_from;
      where.created_at = { ...(where.created_at || {}), [Op.gte]: `${from} 00:00:00` };
    }
    if (req.query.endDate || req.query.date_to) {
      const to = req.query.endDate || req.query.date_to;
      where.created_at = { ...(where.created_at || {}), [Op.lte]: `${to} 23:59:59` };
    }
  }
  return where;
}

function matchesModuleAndStatus(row, query) {
  const decorated = decorate(row);
  if (query.module && decorated.module !== query.module) return false;
  if (query.status && decorated.status !== String(query.status).toUpperCase()) return false;
  return true;
}

export const getLogs = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req, { page: 1, limit: 50, max: 200 });
  const where = buildWhere(req);
  const needsDecorateFilter = Boolean(req.query.module || req.query.status);

  if (needsDecorateFilter) {
    const rows = await db.Logs.findAll({
      where,
      include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
      order: [["created_at", "DESC"]],
      limit: 2000,
    });
    const filtered = rows.map(decorate).filter((row) => matchesModuleAndStatus(row, req.query));
    const items = filtered.slice(offset, offset + limit);
    const pagination = paginationMeta(filtered.length, page, limit);
    return ok(res, {
      items,
      logs: items,
      pagination: { ...pagination, currentPage: page, totalPages: pagination.pages, totalItems: filtered.length, itemsPerPage: limit },
    });
  }

  const { rows, count } = await db.Logs.findAndCountAll({
    where,
    include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });
  const items = rows.map(decorate);
  return ok(res, {
    items,
    logs: items,
    pagination: { ...paginationMeta(count, page, limit), currentPage: page, totalPages: Math.ceil(count / limit) || 1, totalItems: count, itemsPerPage: limit },
  });
});

export const getLogStatistics = asyncHandler(async (req, res) => {
  const where = buildWhere(req);
  const rows = await db.Logs.findAll({
    where,
    include: [{ model: db.Users, as: "user", attributes: ["id", "names"] }],
    order: [["created_at", "DESC"]],
    limit: 5000,
  });
  const decorated = rows.map(decorate);

  const byUser = {};
  const byDate = {};
  const byModule = {};
  const byAction = {};
  let successfulLogs = 0;
  let failedLogs = 0;
  let warningLogs = 0;

  decorated.forEach((row) => {
    if (row.status === "FAILED") failedLogs += 1;
    else if (row.status === "WARNING") warningLogs += 1;
    else successfulLogs += 1;
    const name = row.userName || "System";
    byUser[name] = (byUser[name] || 0) + 1;
    const date = String(row.created_at || "").slice(0, 10);
    if (date) byDate[date] = (byDate[date] || 0) + 1;
    byModule[row.module] = (byModule[row.module] || 0) + 1;
    byAction[row.action || "unknown"] = (byAction[row.action || "unknown"] || 0) + 1;
  });

  const logsByUser = Object.entries(byUser)
    .map(([userName, count]) => ({ userName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const logsByDate = Object.entries(byDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return ok(res, {
    statistics: {
      totalLogs: decorated.length,
      successfulLogs,
      failedLogs,
      warningLogs,
      logsByUser,
      logsByDate,
      logsByModule: byModule,
      logsByAction: byAction,
    },
  });
});

export const exportLogs = asyncHandler(async (req, res) => {
  const where = buildWhere(req);
  const rows = await db.Logs.findAll({
    where,
    include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
    order: [["created_at", "DESC"]],
    limit: 5000,
  });
  const items = rows.map(decorate).filter((row) => matchesModuleAndStatus(row, req.query));
  const header = "ID,User,Role,Module,Action,Status,Description,Created At";
  const csv = [
    header,
    ...items.map((row) => [
      row.id,
      `"${String(row.userName || "").replace(/"/g, '""')}"`,
      `"${String(row.user?.role || "").replace(/"/g, '""')}"`,
      row.module,
      `"${String(row.action || "").replace(/"/g, '""')}"`,
      row.status,
      `"${String(row.description || "").replace(/"/g, '""')}"`,
      row.created_at,
    ].join(",")),
  ].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="logs_${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.status(200).send(csv);
});
