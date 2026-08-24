import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { isAdminRole, isLogisticRole } from "../utils/roleHelpers.js";
import fileStorage from "../utils/fileStorage.js";
const { saveRequestFile } = fileStorage;

function saveProductImage(req, fieldName) {
  const saved = saveRequestFile(req, "products", {
    prefix: fieldName,
    fieldNames: [fieldName],
  });
  return saved?.dbPath || null;
}

function canManage(role) {
  return isAdminRole(role) || isLogisticRole(role);
}

export const getMemberProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  if (req.query.is_active !== undefined) where.is_active = Number(req.query.is_active);
  if (req.query.search) {
    where[Op.or] = [
      { product_name: { [Op.iLike]: `%${req.query.search}%` } },
      { company_name: { [Op.iLike]: `%${req.query.search}%` } },
    ];
  }
  const { rows, count } = await db.MemberProducts.findAndCountAll({
    where,
    order: [["product_id", "DESC"]],
    limit,
    offset,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getMemberProduct = asyncHandler(async (req, res) => {
  const row = await db.MemberProducts.findByPk(req.params.id);
  if (!row) return fail(res, "Member product not found", 404);
  return ok(res, row);
});

export const createMemberProduct = asyncHandler(async (req, res) => {
  if (!canManage(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.product_name || !req.body.company_name) {
    return fail(res, "product_name and company_name are required");
  }
  let image1_url = req.body.image1_url || null;
  let image2_url = req.body.image2_url || null;
  let image3_url = req.body.image3_url || null;
  try {
    image1_url = saveProductImage(req, "image1") || saveProductImage(req, "image") || image1_url;
    image2_url = saveProductImage(req, "image2") || image2_url;
    image3_url = saveProductImage(req, "image3") || image3_url;
  } catch (error) {
    return fail(res, error.message);
  }
  const row = await db.MemberProducts.create({
    product_name: req.body.product_name,
    company_name: req.body.company_name,
    description: req.body.description || null,
    phone: req.body.phone || null,
    address: req.body.address || null,
    website_url: req.body.website_url || null,
    email: req.body.email || null,
    image1_url,
    image2_url,
    image3_url,
    is_active: req.body.is_active === undefined ? 1 : Number(req.body.is_active),
  });
  await createLog(req.user.id, "create_member_product", `Created member product #${row.product_id}`);
  return created(res, row, "Member product created");
});

export const updateMemberProduct = asyncHandler(async (req, res) => {
  if (!canManage(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.MemberProducts.findByPk(req.params.id);
  if (!row) return fail(res, "Member product not found", 404);
  const payload = { ...req.body };
  try {
    const image1 = saveProductImage(req, "image1") || saveProductImage(req, "image");
    const image2 = saveProductImage(req, "image2");
    const image3 = saveProductImage(req, "image3");
    if (image1) payload.image1_url = image1;
    if (image2) payload.image2_url = image2;
    if (image3) payload.image3_url = image3;
  } catch (error) {
    return fail(res, error.message);
  }
  if (payload.is_active !== undefined) payload.is_active = Number(payload.is_active);
  await row.update(payload);
  return ok(res, row, "Member product updated");
});

export const deleteMemberProduct = asyncHandler(async (req, res) => {
  if (!canManage(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.MemberProducts.findByPk(req.params.id);
  if (!row) return fail(res, "Member product not found", 404);
  await row.destroy();
  return ok(res, null, "Member product deleted");
});
