import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { createLog } from "../services/logService.js";
import { isAdminRole, isLogisticRole } from "../utils/roleHelpers.js";

function canManageMembership(role) {
  return isAdminRole(role) || isLogisticRole(role);
}

export const getMembershipYears = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.is_active !== undefined) where.is_active = Number(req.query.is_active);
  const items = await db.MembershipYears.findAll({ where, order: [["year_value", "DESC"]] });
  return ok(res, items);
});

export const createMembershipYear = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.year_value || !req.body.label) return fail(res, "year_value and label are required");
  const row = await db.MembershipYears.create({
    year_value: req.body.year_value,
    label: req.body.label,
    is_active: req.body.is_active === undefined ? 1 : Number(req.body.is_active),
  });
  await createLog(req.user.id, "create_membership_year", `Created year ${row.label}`);
  return created(res, row, "Membership year created");
});

export const updateMembershipYear = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.MembershipYears.findByPk(req.params.id);
  if (!row) return fail(res, "Membership year not found", 404);
  await row.update({
    year_value: req.body.year_value || row.year_value,
    label: req.body.label || row.label,
    is_active: req.body.is_active !== undefined ? Number(req.body.is_active) : row.is_active,
  });
  return ok(res, row, "Membership year updated");
});

export const deleteMembershipYear = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.MembershipYears.findByPk(req.params.id);
  if (!row) return fail(res, "Membership year not found", 404);
  await row.destroy();
  return ok(res, null, "Membership year deleted");
});

export const getMembershipCategories = asyncHandler(async (req, res) => {
  const items = await db.MembershipCategories.findAll({
    include: [{ model: db.Fees, as: "fees" }],
    order: [["display_order", "ASC"], ["category_id", "ASC"]],
  });
  return ok(res, { items });
});

export const createMembershipCategory = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.category_name) return fail(res, "category_name is required");
  const row = await db.MembershipCategories.create({
    category_name: req.body.category_name,
    description: req.body.description || null,
    display_order: req.body.display_order || 0,
  });
  return created(res, row, "Category created");
});

export const updateMembershipCategory = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.MembershipCategories.findByPk(req.params.id);
  if (!row) return fail(res, "Category not found", 404);
  await row.update({
    category_name: req.body.category_name || row.category_name,
    description: req.body.description !== undefined ? req.body.description : row.description,
    display_order: req.body.display_order !== undefined ? req.body.display_order : row.display_order,
  });
  return ok(res, row, "Category updated");
});

export const deleteMembershipCategory = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.MembershipCategories.findByPk(req.params.id);
  if (!row) return fail(res, "Category not found", 404);
  await db.Fees.destroy({ where: { category_id: row.category_id } });
  await db.MembershipAttributes.destroy({ where: { category_id: row.category_id } });
  await row.destroy();
  return ok(res, null, "Category deleted");
});

export const upsertFee = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  const category_id = req.body.category_id || req.params.id;
  if (!category_id || req.body.fee_amount === undefined) return fail(res, "category_id and fee_amount are required");
  const [fee] = await db.Fees.findOrCreate({
    where: { category_id },
    defaults: { fee_amount: req.body.fee_amount, currency: req.body.currency || "RWF" },
  });
  await fee.update({
    fee_amount: req.body.fee_amount,
    currency: req.body.currency || fee.currency,
  });
  return ok(res, fee, "Fee saved");
});

export const getCategoryPlatforms = asyncHandler(async (req, res) => {
  const items = await db.MembershipCategoriesPlatform.findAll({ order: [["id", "ASC"]] });
  return ok(res, items);
});

export const createCategoryPlatform = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.name) return fail(res, "name is required");
  const row = await db.MembershipCategoriesPlatform.create({ name: req.body.name });
  return created(res, row, "Category platform created");
});

export const deleteCategoryPlatform = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.MembershipCategoriesPlatform.findByPk(req.params.id);
  if (!row) return fail(res, "Category platform not found", 404);
  await row.destroy();
  return ok(res, null, "Category platform deleted");
});

export const getServices = asyncHandler(async (req, res) => {
  const items = await db.Services.findAll({ order: [["display_order", "ASC"], ["service_id", "ASC"]] });
  return ok(res, items);
});

export const createService = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.service_name) return fail(res, "service_name is required");
  const row = await db.Services.create({
    service_name: req.body.service_name,
    description: req.body.description || null,
    display_order: req.body.display_order || 0,
  });
  return created(res, row, "Service created");
});

export const getApplicationSettings = asyncHandler(async (req, res) => {
  const row = await db.MembershipApplicationSettings.findOne({ order: [["id", "DESC"]] });
  return ok(res, row);
});

export const updateApplicationSettings = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  if (!req.body.application_link) return fail(res, "application_link is required");
  let row = await db.MembershipApplicationSettings.findOne({ order: [["id", "DESC"]] });
  const payload = {
    application_link: req.body.application_link,
    is_active: req.body.is_active === undefined ? 1 : Number(req.body.is_active),
  };
  if (row) await row.update(payload);
  else row = await db.MembershipApplicationSettings.create(payload);
  return ok(res, row, "Application settings updated");
});

export const setCategoryService = asyncHandler(async (req, res) => {
  if (!canManageMembership(req.user.role)) return fail(res, "Access denied", 403);
  const category_id = req.body.category_id;
  const service_id = req.body.service_id;
  if (!category_id || !service_id) return fail(res, "category_id and service_id are required");
  const [attr] = await db.MembershipAttributes.findOrCreate({
    where: { category_id, service_id },
    defaults: { is_available: req.body.is_available === undefined ? 1 : Number(req.body.is_available) },
  });
  await attr.update({ is_available: req.body.is_available === undefined ? attr.is_available : Number(req.body.is_available) });
  return ok(res, attr, "Category service updated");
});
