import express from "express";
import asyncHandler from "express-async-handler";
import { Op } from "sequelize";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { protect } from "../middlewares/protect.js";
import { requireAdmin } from "../middlewares/roleAccess.js";
import fileStorage from "../utils/fileStorage.js";
const { saveRequestFile } = fileStorage;

export function createWebsiteRouter(modelName, options = {}) {
  const {
    searchFields = [],
    order = [["id", "DESC"]],
    include = [],
    logAction,
    required = [],
    statusField = "status",
    sanitize,
    defaults = {},
    prepareCreate,
    fileField,
  } = options;

  const Model = db[modelName];
  if (!Model) throw new Error(`Unknown model: ${modelName}`);
  const router = express.Router();

  const applyUploadedFile = (req, payload, { requiredOnCreate = false } = {}) => {
    if (!fileField) return payload;
    const folder = fileField.folder;
    const dbField = fileField.dbField || "url";
    const saved = saveRequestFile(req, folder, {
      prefix: fileField.prefix || folder,
      fieldNames: fileField.fieldNames,
    });
    if (saved) {
      payload[dbField] = saved.dbPath;
    } else if (requiredOnCreate && !payload[dbField]) {
      throw new Error(`${fileField.label || dbField} file is required`);
    }
    return payload;
  };

  const listHandler = asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req);
    const where = {};
    const search = String(req.query.search || "").trim();
    if (search && searchFields.length) {
      where[Op.or] = searchFields.map((field) => ({ [field]: { [Op.iLike]: `%${search}%` } }));
    }
    if (req.query.status && statusField) where[statusField] = req.query.status;
    const { rows, count } = await Model.findAndCountAll({
      where,
      include,
      order,
      limit,
      offset,
    });
    const items = sanitize ? rows.map((row) => sanitize(row)) : rows;
    return ok(res, { items, pagination: paginationMeta(count, page, limit) });
  });

  const getHandler = asyncHandler(async (req, res) => {
    const row = await Model.findByPk(req.params.id, { include });
    if (!row) return fail(res, `${modelName} not found`, 404);
    return ok(res, sanitize ? sanitize(row) : row);
  });

  const createHandler = asyncHandler(async (req, res) => {
    let payload = { ...defaults, ...req.body };
    try {
      payload = applyUploadedFile(req, payload, { requiredOnCreate: Boolean(fileField?.requiredOnCreate) });
    } catch (error) {
      return fail(res, error.message);
    }
    const missing = required.filter((field) => !payload[field]);
    if (missing.length) return fail(res, `${missing[0]} is required`);
    if (prepareCreate) Object.assign(payload, await prepareCreate(payload, req));
    const row = await Model.create(payload);
    if (logAction) await createLog(req.user.id, `create_${logAction}`, `Created ${modelName} #${row.id || row[Model.primaryKeyAttribute]}`);
    return created(res, sanitize ? sanitize(row) : row, `${modelName} created`);
  });

  const updateHandler = asyncHandler(async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    if (!row) return fail(res, `${modelName} not found`, 404);
    let body = { ...req.body };
    delete body.id;
    try {
      body = applyUploadedFile(req, body);
    } catch (error) {
      return fail(res, error.message);
    }
    await row.update(body);
    if (logAction) await createLog(req.user.id, `update_${logAction}`, `Updated ${modelName} #${req.params.id}`);
    return ok(res, sanitize ? sanitize(row) : row, `${modelName} updated`);
  });

  const deleteHandler = asyncHandler(async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    if (!row) return fail(res, `${modelName} not found`, 404);
    await row.destroy();
    if (logAction) await createLog(req.user.id, `delete_${logAction}`, `Deleted ${modelName} #${req.params.id}`);
    return ok(res, null, `${modelName} deleted`);
  });

  const toggleHandler = asyncHandler(async (req, res) => {
    const row = await Model.findByPk(req.params.id);
    if (!row) return fail(res, `${modelName} not found`, 404);
    if (statusField && row[statusField] !== undefined) {
      const current = String(row[statusField]);
      const next =
        req.body[statusField] ||
        (current === "active" ? "inactive" : current === "inactive" ? "active" : current === "published" ? "draft" : "published");
      await row.update({ [statusField]: next });
    } else if (row.is_active !== undefined) {
      await row.update({ is_active: Number(row.is_active) === 1 ? 0 : 1 });
    }
    return ok(res, sanitize ? sanitize(row) : row, "Status updated");
  });

  router.get("/", protect, listHandler);
  router.get("/:id", protect, getHandler);
  router.post("/", protect, requireAdmin, createHandler);
  router.put("/:id", protect, requireAdmin, updateHandler);
  router.post("/:id/toggle", protect, requireAdmin, toggleHandler);
  router.delete("/:id", protect, requireAdmin, deleteHandler);
  return router;
}
