import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";

export const getPublicAds = asyncHandler(async (req, res) => {
  const items = await db.Ads.findAll({
    where: { status: "active" },
    order: [["created_at", "DESC"]],
  });
  return ok(res, items);
});

export const getPublicEvents = asyncHandler(async (req, res) => {
  const items = await db.Events.findAll({
    where: { status: "published" },
    include: [{ model: db.EventImages, as: "event_images_eid" }],
    order: [["date", "DESC"]],
  });
  return ok(res, items);
});

export const getPublicEvent = asyncHandler(async (req, res) => {
  const row = await db.Events.findOne({
    where: { id: req.params.id, status: "published" },
    include: [{ model: db.EventImages, as: "event_images_eid" }],
  });
  if (!row) return fail(res, "Event not found", 404);
  return ok(res, row);
});

export const getPublicPrograms = asyncHandler(async (req, res) => {
  const where = { status: "active" };
  if (req.query.category) where.category = req.query.category;
  const items = await db.Programs.findAll({
    where,
    include: [{ model: db.ProgramImages, as: "images" }],
    order: [["id", "DESC"]],
  });
  return ok(res, items);
});

export const getPublicProgram = asyncHandler(async (req, res) => {
  const row = await db.Programs.findOne({
    where: { id: req.params.id, status: "active" },
    include: [{ model: db.ProgramImages, as: "images" }],
  });
  if (!row) return fail(res, "Program not found", 404);
  return ok(res, row);
});

export const getPublicGallery = asyncHandler(async (req, res) => {
  const items = await db.Gallery.findAll({
    where: { status: "active" },
    order: [["created_at", "DESC"]],
  });
  return ok(res, items);
});

export const getPublicPartners = asyncHandler(async (req, res) => {
  const items = await db.Partners.findAll({ order: [["id", "ASC"]] });
  return ok(res, items);
});

export const getPublicTeam = asyncHandler(async (req, res) => {
  const items = await db.Team.findAll({
    where: { active: 1, deleted: { [Op.ne]: "1" } },
    attributes: { exclude: ["password", "resetcode"] },
    order: [["id", "ASC"]],
  });
  return ok(res, items);
});

export const getPublicCompany = asyncHandler(async (req, res) => {
  const row = await db.CompanyInfo.findOne({ order: [["id", "DESC"]] });
  return ok(res, row);
});

export const getPublicOrganization = asyncHandler(async (req, res) => {
  const items = await db.OrganizationStructure.findAll({
    where: { is_active: 1 },
    order: [["display_order", "ASC"], ["id", "ASC"]],
  });
  return ok(res, items);
});

export const getPublicPlatforms = asyncHandler(async (req, res) => {
  const items = await db.Platforms.findAll({
    where: { status: "published" },
    include: [{ model: db.PlatformDetails, as: "details" }],
    order: [["display_order", "ASC"], ["id", "ASC"]],
  });
  return ok(res, items);
});

export const getPublicPlatform = asyncHandler(async (req, res) => {
  const row = await db.Platforms.findOne({
    where: { id: req.params.id, status: "published" },
    include: [{ model: db.PlatformDetails, as: "details" }],
  });
  if (!row) return fail(res, "Platform not found", 404);
  return ok(res, row);
});

export const getPublicMemberProducts = asyncHandler(async (req, res) => {
  const items = await db.MemberProducts.findAll({
    where: { is_active: 1 },
    order: [["product_id", "DESC"]],
  });
  return ok(res, items);
});

export const getPublicApplicationSettings = asyncHandler(async (req, res) => {
  const row = await db.MembershipApplicationSettings.findOne({
    where: { is_active: 1 },
    order: [["id", "DESC"]],
  });
  return ok(res, row);
});

export const getPublicMembership = asyncHandler(async (req, res) => {
  const categories = await db.MembershipCategories.findAll({
    include: [{ model: db.Fees, as: "fees" }],
    order: [["display_order", "ASC"], ["category_id", "ASC"]],
  });
  const services = await db.Services.findAll({
    order: [["display_order", "ASC"], ["service_id", "ASC"]],
  });
  const attributes = await db.MembershipAttributes.findAll();
  return ok(res, { categories, services, attributes });
});

export const createContactMessage = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = body.name || body.names;
  const { email, subject, message } = body;
  if (!name || !email || !subject || !message) {
    return fail(res, "name, email, subject, and message are required");
  }
  const row = await db.ContactMessages.create({ name, email, subject, message, status: "unread" });
  return created(res, { id: row.id }, "Message received");
});

export const subscribe = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return fail(res, "A valid email is required");
  const [row, wasCreated] = await db.Subscribers.findOrCreate({
    where: { email },
    defaults: {
      status: "active",
      source: req.body.source || "footer",
      ip_address: req.ip || null,
      subscribed_at: new Date(),
    },
  });
  if (!wasCreated && row.status !== "active") {
    await row.update({ status: "active", subscribed_at: new Date() });
  }
  return created(res, { id: row.id }, "Subscribed");
});
