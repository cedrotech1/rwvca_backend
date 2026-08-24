import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail } from "../utils/apiResponse.js";
import { createLog } from "../services/logService.js";
import { isAdminRole } from "../utils/roleHelpers.js";
import fileStorage from "../utils/fileStorage.js";
const { saveRequestFile } = fileStorage;

export const getCompanyInfo = asyncHandler(async (req, res) => {
  const row = await db.CompanyInfo.findOne({ order: [["id", "DESC"]] });
  return ok(res, row);
});

export const updateCompanyInfo = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const body = req.body || {};
  if (!body.company_name || !body.email || !body.phone || !body.address) {
    return fail(res, "company_name, email, phone, and address are required");
  }
  let row = await db.CompanyInfo.findOne({ order: [["id", "DESC"]] });
  let logo = body.logo !== undefined ? body.logo : row?.logo || null;
  try {
    const saved = saveRequestFile(req, "logo", { prefix: "logo", fieldNames: ["logo", "image", "file"] });
    if (saved) logo = saved.dbPath;
  } catch (error) {
    return fail(res, error.message);
  }
  const payload = {
    company_name: body.company_name,
    email: body.email,
    phone: body.phone,
    address: body.address,
    website: body.website || null,
    facebook: body.facebook || null,
    twitter: body.twitter || null,
    instagram: body.instagram || null,
    linkedin: body.linkedin || null,
    youtube: body.youtube || null,
    logo,
  };
  if (row) await row.update(payload);
  else row = await db.CompanyInfo.create(payload);
  await createLog(req.user.id, "update_company", "Updated company information");
  return ok(res, row, "Company information updated");
});
