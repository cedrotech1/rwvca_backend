import express from "express";
import asyncHandler from "express-async-handler";
import { Op } from "sequelize";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { protect } from "../middlewares/protect.js";
import { optionalProtect } from "../middlewares/protect.js";
import { requireAdmin } from "../middlewares/roleAccess.js";

export function createCrudRouter(modelName, options = {}) {
  const {
    searchFields = [],
    order = [["id", "DESC"]],
    publicList = false,
    publicGet = false,
    include = [],
    logAction,
  } = options;

  const Model = db[modelName];
  if (!Model) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  const router = express.Router();

  const listHandler = asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req);
    const where = {};
    const search = String(req.query.search || "").trim();
    if (search && searchFields.length) {
      where[Op.or] = searchFields.map((field) => ({
        [field]: { [Op.iLike]: `%${search}%` },
      }));
    }
    if (req.query.status) where.status = req.query.status;

    const { rows, count } = await Model.findAndCountAll({
      where,
      include,
      order,
      limit,
      offset,
    });

    return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
  });

  const getHandler = asyncHandler(async (req, res) => {
    const row = await Model.findByPk(req.params.id, { include });
    if (!row) return fail(res, `${modelName} not found`, 404);
    return ok(res, row);
  });

  const createHandler = asyncHandler(async (req, res) => {
    const row = await Model.create(req.body);
    if (logAction) {
      await createLog(req.user?.id, `create_${logAction}`, `Created ${modelName} #${row.id}`);
    }
    return created(res, row, `${modelName} created`);
  });

  const updateHandler = asyncHandler(async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    if (!row) return fail(res, `${modelName} not found`, 404);
    await row.update(req.body);
    if (logAction) {
      await createLog(req.user?.id, `update_${logAction}`, `Updated ${modelName} #${row.id}`);
    }
    return ok(res, row, `${modelName} updated`);
  });

  const deleteHandler = asyncHandler(async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    if (!row) return fail(res, `${modelName} not found`, 404);
    await row.destroy();
    if (logAction) {
      await createLog(req.user?.id, `delete_${logAction}`, `Deleted ${modelName} #${req.params.id}`);
    }
    return ok(res, null, `${modelName} deleted`);
  });

  router.get("/", publicList ? optionalProtect : protect, listHandler);
  router.get("/:id", publicGet ? optionalProtect : protect, getHandler);
  router.post("/", protect, requireAdmin, createHandler);
  router.put("/:id", protect, requireAdmin, updateHandler);
  router.delete("/:id", protect, requireAdmin, deleteHandler);

  return router;
}
