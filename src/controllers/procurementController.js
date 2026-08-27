import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { canAccessProcurement, canManageProcurement } from "../utils/roleHelpers.js";
import { toPlainText } from "../utils/plainText.js";
import fileStorage from "../utils/fileStorage.js";

const { saveRequestFile } = fileStorage;

const STATUSES = ["draft", "recorded", "in_progress", "completed", "cancelled"];
const USER_ATTR = { attributes: ["id", "names", "email", "role"] };

function denyUnlessAccess(req, res) {
  if (!canAccessProcurement(req.user)) {
    fail(res, "Access denied: procurement module", 403);
    return false;
  }
  return true;
}

function denyUnlessManage(req, res) {
  if (!canManageProcurement(req.user)) {
    fail(res, "Access denied: only Procurement Officer (or authorized managers) can change records", 403);
    return false;
  }
  return true;
}

async function loadProcurement(id) {
  return db.Procurements.findByPk(id, {
    include: [
      { model: db.Users, as: "creator", ...USER_ATTR },
      { model: db.Users, as: "updater", ...USER_ATTR },
      {
        model: db.ProcurementDocuments,
        as: "documents",
        include: [{ model: db.Users, as: "uploader", ...USER_ATTR }],
      },
      {
        model: db.ProcurementNotes,
        as: "notes_list",
        include: [{ model: db.Users, as: "author", ...USER_ATTR }],
      },
    ],
    order: [
      [{ model: db.ProcurementDocuments, as: "documents" }, "id", "DESC"],
      [{ model: db.ProcurementNotes, as: "notes_list" }, "id", "DESC"],
    ],
  });
}

function parseAmount(value) {
  if (value === undefined || value === null || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export const getProcurementDashboard = asyncHandler(async (req, res) => {
  if (!denyUnlessAccess(req, res)) return;

  const year = Number(req.query.year) || new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);

  const yearWhere = { created_at: { [Op.between]: [from, to] } };
  const [total, byStatus, yearTotal, yearAmountRow, recent, docsCount] = await Promise.all([
    db.Procurements.count(),
    db.Procurements.findAll({
      attributes: ["status", [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
    db.Procurements.count({ where: yearWhere }),
    db.Procurements.findOne({
      attributes: [[db.sequelize.fn("COALESCE", db.sequelize.fn("SUM", db.sequelize.col("amount")), 0), "total_amount"]],
      where: yearWhere,
      raw: true,
    }),
    db.Procurements.findAll({
      include: [{ model: db.Users, as: "creator", ...USER_ATTR }],
      order: [["id", "DESC"]],
      limit: 8,
    }),
    db.ProcurementDocuments.count(),
  ]);

  const statusMap = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  (byStatus || []).forEach((row) => {
    statusMap[row.status] = Number(row.count || 0);
  });

  return ok(res, {
    can_manage: canManageProcurement(req.user),
    stats: {
      total,
      year,
      year_total: yearTotal,
      year_amount: Number(yearAmountRow?.total_amount || 0),
      documents: docsCount,
      by_status: statusMap,
    },
    recent,
  });
});

export const getProcurements = asyncHandler(async (req, res) => {
  if (!denyUnlessAccess(req, res)) return;

  const { page, limit, offset } = getPagination(req);
  const where = {};
  const search = toPlainText(req.query.search);
  if (req.query.status) where.status = req.query.status;
  if (req.query.category) where.category = { [Op.iLike]: `%${req.query.category}%` };
  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { reference_no: { [Op.iLike]: `%${search}%` } },
      { supplier_name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { rows, count } = await db.Procurements.findAndCountAll({
    where,
    include: [
      { model: db.Users, as: "creator", ...USER_ATTR },
      { model: db.ProcurementDocuments, as: "documents", attributes: ["id"] },
    ],
    order: [["id", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return ok(res, {
    items: rows,
    pagination: paginationMeta(count, page, limit),
    can_manage: canManageProcurement(req.user),
  });
});

export const getProcurement = asyncHandler(async (req, res) => {
  if (!denyUnlessAccess(req, res)) return;
  const row = await loadProcurement(req.params.id);
  if (!row) return fail(res, "Procurement record not found", 404);
  return ok(res, { ...row.toJSON(), can_manage: canManageProcurement(req.user) });
});

export const createProcurement = asyncHandler(async (req, res) => {
  if (!denyUnlessManage(req, res)) return;

  const title = toPlainText(req.body.title);
  if (!title) return fail(res, "title is required");

  const status = STATUSES.includes(String(req.body.status || "").toLowerCase())
    ? String(req.body.status).toLowerCase()
    : "recorded";

  const row = await db.Procurements.create({
    reference_no: toPlainText(req.body.reference_no) || null,
    title,
    category: toPlainText(req.body.category) || null,
    description: toPlainText(req.body.description) || null,
    supplier_name: toPlainText(req.body.supplier_name) || null,
    amount: parseAmount(req.body.amount),
    currency: toPlainText(req.body.currency) || "RWF",
    status,
    requested_date: req.body.requested_date || null,
    expected_date: req.body.expected_date || null,
    completed_date: req.body.completed_date || null,
    notes: toPlainText(req.body.notes) || null,
    created_by: req.user.id,
    updated_by: req.user.id,
  });

  let saved = null;
  try {
    saved = saveRequestFile(req, "procurement", {
      prefix: "procurement",
      fieldNames: ["document", "file", "attachment"],
    });
  } catch (error) {
    return fail(res, error.message);
  }

  if (saved?.dbPath) {
    await db.ProcurementDocuments.create({
      procurement_id: row.id,
      title: toPlainText(req.body.document_title) || saved.originalName || "Document",
      file_path: saved.dbPath,
      file_name: saved.originalName || null,
      mime_type: saved.mimeType || null,
      uploaded_by: req.user.id,
    });
  }

  await createLog(req.user.id, "create_procurement", `Created procurement #${row.id}`);
  return created(res, await loadProcurement(row.id), "Procurement record created");
});

export const updateProcurement = asyncHandler(async (req, res) => {
  if (!denyUnlessManage(req, res)) return;
  const row = await db.Procurements.findByPk(req.params.id);
  if (!row) return fail(res, "Procurement record not found", 404);

  const status = req.body.status
    ? (STATUSES.includes(String(req.body.status).toLowerCase())
      ? String(req.body.status).toLowerCase()
      : row.status)
    : row.status;

  await row.update({
    reference_no: req.body.reference_no !== undefined ? toPlainText(req.body.reference_no) || null : row.reference_no,
    title: req.body.title !== undefined ? toPlainText(req.body.title) || row.title : row.title,
    category: req.body.category !== undefined ? toPlainText(req.body.category) || null : row.category,
    description: req.body.description !== undefined ? toPlainText(req.body.description) || null : row.description,
    supplier_name: req.body.supplier_name !== undefined ? toPlainText(req.body.supplier_name) || null : row.supplier_name,
    amount: req.body.amount !== undefined ? parseAmount(req.body.amount) : row.amount,
    currency: req.body.currency !== undefined ? toPlainText(req.body.currency) || "RWF" : row.currency,
    status,
    requested_date: req.body.requested_date !== undefined ? req.body.requested_date || null : row.requested_date,
    expected_date: req.body.expected_date !== undefined ? req.body.expected_date || null : row.expected_date,
    completed_date: req.body.completed_date !== undefined ? req.body.completed_date || null : row.completed_date,
    notes: req.body.notes !== undefined ? toPlainText(req.body.notes) || null : row.notes,
    updated_by: req.user.id,
  });

  await createLog(req.user.id, "update_procurement", `Updated procurement #${row.id}`);
  return ok(res, await loadProcurement(row.id), "Procurement record updated");
});

export const deleteProcurement = asyncHandler(async (req, res) => {
  if (!denyUnlessManage(req, res)) return;
  const row = await db.Procurements.findByPk(req.params.id);
  if (!row) return fail(res, "Procurement record not found", 404);
  await db.ProcurementDocuments.destroy({ where: { procurement_id: row.id } });
  await db.ProcurementNotes.destroy({ where: { procurement_id: row.id } });
  await row.destroy();
  await createLog(req.user.id, "delete_procurement", `Deleted procurement #${req.params.id}`);
  return ok(res, null, "Procurement record deleted");
});

export const addProcurementDocument = asyncHandler(async (req, res) => {
  if (!denyUnlessManage(req, res)) return;
  const row = await db.Procurements.findByPk(req.params.id);
  if (!row) return fail(res, "Procurement record not found", 404);

  let saved = null;
  try {
    saved = saveRequestFile(req, "procurement", {
      prefix: "procurement",
      fieldNames: ["document", "file", "attachment"],
    });
  } catch (error) {
    return fail(res, error.message);
  }
  if (!saved?.dbPath) return fail(res, "document file is required");

  const doc = await db.ProcurementDocuments.create({
    procurement_id: row.id,
    title: toPlainText(req.body.title) || saved.originalName || "Document",
    file_path: saved.dbPath,
    file_name: saved.originalName || null,
    mime_type: saved.mimeType || null,
    uploaded_by: req.user.id,
  });

  await createLog(req.user.id, "upload_procurement_document", `Uploaded document #${doc.id} for procurement #${row.id}`);
  return created(res, await loadProcurement(row.id), "Document uploaded");
});

export const deleteProcurementDocument = asyncHandler(async (req, res) => {
  if (!denyUnlessManage(req, res)) return;
  const doc = await db.ProcurementDocuments.findByPk(req.params.documentId);
  if (!doc) return fail(res, "Document not found", 404);
  const procurementId = doc.procurement_id;
  await doc.destroy();
  await createLog(req.user.id, "delete_procurement_document", `Deleted procurement document #${req.params.documentId}`);
  return ok(res, await loadProcurement(procurementId), "Document deleted");
});

export const addProcurementNote = asyncHandler(async (req, res) => {
  if (!denyUnlessManage(req, res)) return;
  const row = await db.Procurements.findByPk(req.params.id);
  if (!row) return fail(res, "Procurement record not found", 404);
  const note = toPlainText(req.body.note || req.body.message);
  if (!note) return fail(res, "note is required");

  await db.ProcurementNotes.create({
    procurement_id: row.id,
    note,
    created_by: req.user.id,
  });

  return created(res, await loadProcurement(row.id), "Note added");
});
