import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { canManageInventory } from "../utils/roleHelpers.js";

async function loadItem(id) {
  return db.InventoryItems.findByPk(id, {
    include: [
      { model: db.Users, as: "creator", attributes: ["id", "names", "email"] },
      {
        model: db.InventoryTransactions,
        as: "transactions",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email"] }],
      },
    ],
    order: [[{ model: db.InventoryTransactions, as: "transactions" }, "id", "DESC"]],
  });
}

export const getInventoryItems = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  const search = String(req.query.search || "").trim();
  if (req.query.category) where.category = req.query.category;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { category: { [Op.iLike]: `%${search}%` } },
    ];
  }
  const { rows, count } = await db.InventoryItems.findAndCountAll({
    where,
    include: [{ model: db.Users, as: "creator", attributes: ["id", "names", "email"] }],
    order: [["name", "ASC"]],
    limit,
    offset,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getInventoryItem = asyncHandler(async (req, res) => {
  const row = await loadItem(req.params.id);
  if (!row) return fail(res, "Inventory item not found", 404);
  return ok(res, row);
});

export const createInventoryItem = asyncHandler(async (req, res) => {
  if (!canManageInventory(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.name) return fail(res, "name is required");
  const row = await db.InventoryItems.create({
    name: req.body.name,
    description: req.body.description || null,
    category: req.body.category || null,
    unit: req.body.unit || "pieces",
    current_quantity: Number(req.body.current_quantity || 0),
    min_stock: Number(req.body.min_stock || 10),
    created_by: req.user.id,
  });
  if (Number(row.current_quantity) > 0) {
    await db.InventoryTransactions.create({
      item_id: row.id,
      type: "in",
      quantity: row.current_quantity,
      reason: "Opening stock",
      user_id: req.user.id,
      transaction_date: new Date(),
    });
  }
  await createLog(req.user.id, "create_inventory", `Created inventory item #${row.id}`);
  return created(res, await loadItem(row.id), "Inventory item created");
});

export const updateInventoryItem = asyncHandler(async (req, res) => {
  if (!canManageInventory(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.InventoryItems.findByPk(req.params.id);
  if (!row) return fail(res, "Inventory item not found", 404);
  await row.update({
    name: req.body.name || row.name,
    description: req.body.description !== undefined ? req.body.description : row.description,
    category: req.body.category !== undefined ? req.body.category : row.category,
    unit: req.body.unit || row.unit,
    min_stock: req.body.min_stock !== undefined ? req.body.min_stock : row.min_stock,
  });
  return ok(res, await loadItem(row.id), "Inventory item updated");
});

export const addInventoryTransaction = asyncHandler(async (req, res) => {
  if (!canManageInventory(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.InventoryItems.findByPk(req.params.id);
  if (!row) return fail(res, "Inventory item not found", 404);
  const type = req.body.type === "out" ? "out" : "in";
  const quantity = Number(req.body.quantity || 0);
  if (quantity <= 0) return fail(res, "quantity must be greater than 0");
  const nextQty = type === "in" ? Number(row.current_quantity || 0) + quantity : Number(row.current_quantity || 0) - quantity;
  if (nextQty < 0) return fail(res, "Insufficient stock");
  const txn = await db.InventoryTransactions.create({
    item_id: row.id,
    type,
    quantity,
    reason: req.body.reason || null,
    user_id: req.user.id,
    transaction_date: req.body.transaction_date || new Date(),
  });
  await row.update({ current_quantity: nextQty });
  return created(res, { transaction: txn, item: await loadItem(row.id) }, "Inventory transaction recorded");
});

export const deleteInventoryItem = asyncHandler(async (req, res) => {
  if (!canManageInventory(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.InventoryItems.findByPk(req.params.id);
  if (!row) return fail(res, "Inventory item not found", 404);
  await db.InventoryTransactions.destroy({ where: { item_id: row.id } });
  await row.destroy();
  return ok(res, null, "Inventory item deleted");
});

export const getInventoryTransactions = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.item_id) where.item_id = req.query.item_id;
  const rows = await db.InventoryTransactions.findAll({
    where,
    include: [
      { model: db.InventoryItems, as: "item", attributes: ["id", "name", "unit"] },
      { model: db.Users, as: "user", attributes: ["id", "names", "email"] },
    ],
    order: [["transaction_date", "DESC"]],
    limit: Number(req.query.limit || 100),
  });
  return ok(res, rows);
});

export const getInventorySummary = asyncHandler(async (_req, res) => {
  const items = await db.InventoryItems.findAll({
    order: [["category", "ASC"], ["name", "ASC"]],
  });
  const grouped = new Map();
  items.forEach((item) => {
    const key = item.category || "Uncategorized";
    if (!grouped.has(key)) grouped.set(key, { category: key, item_names: [], total_stock: 0, low_stock_count: 0 });
    const row = grouped.get(key);
    row.item_names.push(item.name);
    row.total_stock += Number(item.current_quantity || 0);
    if (Number(item.current_quantity || 0) <= Number(item.min_stock || 0)) row.low_stock_count += 1;
  });
  const data = Array.from(grouped.values()).map((row) => ({
    ...row,
    item_names: row.item_names.join(", "),
  }));
  if (data.length) {
    data.push({
      category: "TOTAL",
      item_names: data.flatMap((row) => row.item_names ? row.item_names.split(", ").filter(Boolean) : []).join(", "),
      total_stock: data.reduce((sum, row) => sum + Number(row.total_stock || 0), 0),
      low_stock_count: data.reduce((sum, row) => sum + Number(row.low_stock_count || 0), 0),
    });
  }
  return ok(res, data);
});

export const deleteInventoryTransaction = asyncHandler(async (req, res) => {
  if (!canManageInventory(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.InventoryTransactions.findByPk(req.params.transactionId);
  if (!row) return fail(res, "Transaction not found", 404);
  await row.destroy();
  await createLog(req.user.id, "delete_inventory_transaction", `Deleted inventory transaction #${row.id}`);
  return ok(res, null, "Transaction deleted successfully");
});

export const truncateInventory = asyncHandler(async (req, res) => {
  if (!canManageInventory(req.user.role)) return fail(res, "Access denied", 403);
  await db.InventoryTransactions.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
  await db.InventoryItems.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
  await createLog(req.user.id, "truncate_inventory", "Truncated all inventory data");
  return ok(res, null, "All inventory data has been cleared successfully");
});
