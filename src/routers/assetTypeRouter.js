import express from "express";
import asyncHandler from "express-async-handler";
import { Op } from "sequelize";
import db from "../database/models/index.js";
import { protect } from "../middlewares/protect.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { canManageAssets } from "../utils/roleHelpers.js";

const router = express.Router();

router.get("/", protect, asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  const search = String(req.query.search || "").trim();
  if (search) {
    where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }];
  }
  const { rows, count } = await db.AssetTypes.findAndCountAll({
    where,
    order: [["name", "ASC"]],
    limit,
    offset,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
}));

router.post("/", protect, asyncHandler(async (req, res) => {
  if (!canManageAssets(req.user.role)) return fail(res, "Access denied", 403);
  const name = String(req.body.name || "").trim();
  if (!name) return fail(res, "name is required");
  const existing = await db.AssetTypes.findOne({ where: { name } });
  if (existing) return fail(res, "An asset type with this name already exists.");
  const row = await db.AssetTypes.create({
    name,
    description: req.body.description || null,
  });
  await createLog(req.user.id, "create_asset_types", `Created AssetTypes #${row.id}`);
  return created(res, row, "AssetTypes created");
}));

export default router;
