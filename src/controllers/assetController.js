import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { canManageAssets } from "../utils/roleHelpers.js";

const STATUSES = ["available", "issued", "returned", "damaged"];
const LOGISTIC_NOTIFY_ROLES = ["logistic"];

function assetLink(id) {
  return `/assets?asset=${id}`;
}

async function getLogisticsUsers() {
  return db.Users.findAll({
    where: { role: { [Op.in]: LOGISTIC_NOTIFY_ROLES } },
    attributes: ["id", "names", "email", "role"],
  });
}

async function addAssetLog(assetId, userId, action, assignedTo, comment) {
  await db.AssetLogs.create({
    asset_id: assetId,
    action,
    performed_by_user_id: userId,
    assigned_to_user_id: assignedTo || null,
    comment: comment || null,
  });
}

async function loadAsset(id) {
  return db.Assets.findByPk(id, {
    include: [
      { model: db.AssetTypes, as: "asset_type" },
      { model: db.Users, as: "user", attributes: ["id", "names", "email", "role"], include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }] },
      {
        model: db.AssetLogs,
        as: "asset_logs_asset_id",
        include: [
          { model: db.Users, as: "performed_by_user", attributes: ["id", "names", "email"] },
          { model: db.Users, as: "assigned_to_user", attributes: ["id", "names", "email"] },
        ],
      },
    ],
    order: [[{ model: db.AssetLogs, as: "asset_logs_asset_id" }, "id", "DESC"]],
  });
}

async function notifyAssetUser(userId, title, message, id, { actor, intro, note, actionRequired } = {}) {
  if (!userId) return;
  const row = await loadAsset(id);
  await createNotification({
      whatsapp: true,
    receiverId: userId,
    type: "system",
    title,
    message,
    link: assetLink(id),
    userType: "user",
    email: true,
    emailPayload: buildEmailPayload("asset", row || { id, name: title }, {
      intro: intro || message,
      actor,
      note,
      actionRequired,
    }),
  });
}

async function notifyLogistics(title, message, id, { actor, intro, note, actionRequired } = {}) {
  const logistics = await getLogisticsUsers();
  const row = await loadAsset(id);
  await Promise.all(logistics.map((user) => createNotification({
      whatsapp: true,
    receiverId: user.id,
    type: "system",
    title,
    message,
    link: assetLink(id),
    userType: "user",
    email: true,
    emailPayload: buildEmailPayload("asset", row || { id, name: title }, {
      intro: intro || message,
      actor,
      note,
      actionRequired,
    }),
  })));
}

export const getAssets = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const where = {};
  const isLogistics = canManageAssets(req.user.role);
  const search = String(req.query.search || "").trim();
  const searchType = String(req.query.search_type || "all").toLowerCase();
  if (req.query.status) where.status = req.query.status;
  if (req.query.asset_type_id || req.query.asset_type) where.asset_type_id = req.query.asset_type_id || req.query.asset_type;
  if (req.query.location) where.location = req.query.location;
  if (req.query.department) {
    where["$user.department.name$"] = { [Op.iLike]: `%${String(req.query.department).trim()}%` };
  }
  if (!isLogistics) {
    where.user_id = req.user.id;
  } else if (req.query.user_id) {
    where.user_id = req.query.user_id;
  }
  if (search) {
    const searchLike = { [Op.iLike]: `%${search}%` };
    switch (searchType) {
      case "user":
        where["$user.names$"] = searchLike;
        break;
      case "asset":
        where.name = searchLike;
        break;
      case "serial":
        where.serial_number = searchLike;
        break;
      case "description":
        where.description = searchLike;
        break;
      case "all":
      default:
        where[Op.or] = [
          { name: searchLike },
          { serial_number: searchLike },
          { description: searchLike },
          { "$user.names$": searchLike },
        ];
        break;
    }
  }
  const { rows, count } = await db.Assets.findAndCountAll({
    where,
    include: [
      { model: db.AssetTypes, as: "asset_type" },
      { model: db.Users, as: "user", attributes: ["id", "names", "email"], include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }] },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getAsset = asyncHandler(async (req, res) => {
  const row = await loadAsset(req.params.id);
  if (!row) return fail(res, "Asset not found", 404);
  if (!canManageAssets(req.user.role) && Number(row.user_id) !== Number(req.user.id)) {
    return fail(res, "Access denied", 403);
  }
  return ok(res, row);
});

export const createAsset = asyncHandler(async (req, res) => {
  if (!req.body.name) return fail(res, "name is required");
  if (!req.body.asset_type_id) return fail(res, "asset_type_id is required");
  const isLogistics = canManageAssets(req.user.role);
  const requestedLocation = req.body.initial_location || req.body.location || "user";
  const location = isLogistics ? requestedLocation : "user";
  if (!["office", "user"].includes(location)) {
    return fail(res, "location must be one of: office, user");
  }
  if (location === "office" && !isLogistics) {
    return fail(res, "You are not authorized to record office assets.");
  }
  const user_id = location === "office" ? null : req.user.id;
  const status = location === "office" ? "available" : "issued";
  const row = await db.Assets.create({
    name: req.body.name,
    asset_type_id: req.body.asset_type_id,
    description: req.body.description || null,
    serial_number: req.body.serial_number || null,
    label_number: req.body.label_number || null,
    location,
    user_id,
    status,
    condition_notes: req.body.condition_notes || null,
  });
  await addAssetLog(row.id, req.user.id, "issued", row.user_id, `Asset recorded by ${isLogistics ? "logistic" : "user"}`);
  await createLog(req.user.id, "create_asset", `Created asset #${row.id}`);
  await notifyAssetUser(req.user.id, `Asset Recorded: ${row.name}`, `New asset recorded: ${row.name}`, row.id, {
    actor: req.user,
    intro: `A new asset "${row.name}" has been recorded under your account.`,
  });
  return created(res, await loadAsset(row.id), "Asset created");
});

export const updateAsset = asyncHandler(async (req, res) => {
  const isLogistics = canManageAssets(req.user.role);
  const row = await db.Assets.findByPk(req.params.id);
  if (!row) return fail(res, "Asset not found", 404);
  const isAllowedUserEdit = Number(row.user_id) === Number(req.user.id) && row.revert_status === "yes" && row.status !== "returned";
  if (!isLogistics && !isAllowedUserEdit) return fail(res, "Not authorized to edit this asset.", 403);
  await row.update({
    name: req.body.name || row.name,
    asset_type_id: req.body.asset_type_id !== undefined ? req.body.asset_type_id : row.asset_type_id,
    description: req.body.description !== undefined ? req.body.description : row.description,
    serial_number: req.body.serial_number !== undefined ? req.body.serial_number : row.serial_number,
    label_number: req.body.label_number !== undefined ? req.body.label_number : row.label_number,
    condition_notes: req.body.condition_notes !== undefined ? req.body.condition_notes : row.condition_notes,
    revert_status: isLogistics ? row.revert_status : "no",
  });
  const assetName = req.body.name || row.name;
  await addAssetLog(row.id, req.user.id, "edited", row.user_id, `Edited by ${isLogistics ? "logistics" : "user"}`);
  if (isLogistics && row.user_id) {
    await notifyAssetUser(row.user_id, `Asset Edited: ${assetName}`, `Your asset '${assetName}' has been edited by logistics.`, row.id, {
      actor: req.user,
      intro: `Your asset "${assetName}" has been updated by the logistics team.`,
    });
  } else if (!isLogistics) {
    await notifyLogistics(`Asset Edited by User: ${assetName}`, `User ${req.user.names} has edited asset: ${assetName}`, row.id, {
      actor: req.user,
      intro: `${req.user.names} has edited asset "${assetName}" and logistics should review the changes.`,
    });
  }
  return ok(res, await loadAsset(row.id), "Asset updated");
});

export const issueAsset = asyncHandler(async (req, res) => {
  if (!canManageAssets(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Assets.findByPk(req.params.id);
  if (!row) return fail(res, "Asset not found", 404);
  if (!req.body.user_id) return fail(res, "user_id is required");
  await row.update({
    status: "issued",
    location: "user",
    user_id: req.body.user_id,
    issued_date: req.body.issued_date || new Date(),
    returned_date: null,
  });
  await addAssetLog(row.id, req.user.id, "issued", req.body.user_id, req.body.comment || "Asset issued");
  return ok(res, await loadAsset(row.id), "Asset issued");
});

export const returnAsset = asyncHandler(async (req, res) => {
  if (!canManageAssets(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Assets.findByPk(req.params.id);
  if (!row) return fail(res, "Asset not found", 404);
  if (row.status !== "issued") return fail(res, "No changes made or asset not issued.");
  const previousUser = row.user_id;
  await row.update({
    status: req.body.status === "damaged" ? "damaged" : "returned",
    returned_date: req.body.returned_date || new Date(),
    condition_notes: req.body.comment !== undefined ? req.body.comment : (req.body.condition_notes !== undefined ? req.body.condition_notes : row.condition_notes),
  });
  await addAssetLog(row.id, req.user.id, "returned", previousUser, `Returned by logistics: ${req.body.comment || ""}`.trim());
  if (previousUser) {
    await notifyAssetUser(previousUser, `Asset Returned: ${row.name}`, `Your asset '${row.name}' has been returned.`, row.id, {
      actor: req.user,
      intro: `Your asset "${row.name}" has been marked as returned by logistics.`,
      note: req.body.comment,
    });
  }
  return ok(res, await loadAsset(row.id), "Asset returned");
});

export const deleteAsset = asyncHandler(async (req, res) => {
  if (!canManageAssets(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Assets.findByPk(req.params.id);
  if (!row) return fail(res, "Asset not found", 404);
  const assignedUserId = row.user_id;
  const assetName = row.name;
  await db.AssetLogs.destroy({ where: { asset_id: row.id } });
  await row.destroy();
  if (assignedUserId) {
    await notifyAssetUser(assignedUserId, `Asset Deleted: ${assetName}`, `Your asset '${assetName}' has been deleted by logistics.`, req.params.id, {
      actor: req.user,
      intro: `Your asset "${assetName}" has been removed from the asset register by logistics.`,
    });
  }
  return ok(res, null, "Asset deleted");
});

export const requestAssetEdit = asyncHandler(async (req, res) => {
  if (canManageAssets(req.user.role)) return fail(res, "Invalid request.", 400);
  const row = await db.Assets.findByPk(req.params.id);
  if (!row || Number(row.user_id) !== Number(req.user.id) || row.revert_status !== "no") {
    return fail(res, "Invalid request.", 400);
  }
  const reason = String(req.body.reason || "").trim();
  await row.update({ revert_status: "requested" });
  await addAssetLog(row.id, req.user.id, "request_edit", row.user_id, `Edit request: ${reason}`);
  await notifyLogistics(`Asset Edit Request: ${row.name}`, `User ${req.user.names} requested to edit asset '${row.name}'. Reason: ${reason}`, row.id, {
    actor: req.user,
    intro: `${req.user.names} has requested permission to edit asset "${row.name}".`,
    note: reason,
    actionRequired: "Please review the edit request and approve or reject it.",
  });
  return ok(res, await loadAsset(row.id), "Edit request submitted.");
});

export const approveAssetEdit = asyncHandler(async (req, res) => {
  if (!canManageAssets(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Assets.findByPk(req.params.id);
  if (!row || row.revert_status !== "requested") return fail(res, "Invalid request.", 400);
  await row.update({ revert_status: "yes" });
  await addAssetLog(row.id, req.user.id, "approve_edit", row.user_id, "Edit request approved");
  if (row.user_id) {
    await notifyAssetUser(row.user_id, `Edit Request Approved: ${row.name}`, `Your edit request for asset '${row.name}' has been approved.`, row.id, {
      actor: req.user,
      intro: `Your request to edit asset "${row.name}" has been approved. You may now update the asset details.`,
      actionRequired: "Please make your edits promptly and save the updated asset information.",
    });
  }
  return ok(res, await loadAsset(row.id), "Edit request approved.");
});

export const rejectAssetEdit = asyncHandler(async (req, res) => {
  if (!canManageAssets(req.user.role)) return fail(res, "Access denied", 403);
  const row = await db.Assets.findByPk(req.params.id);
  if (!row || row.revert_status !== "requested") return fail(res, "Invalid request.", 400);
  const reason = String(req.body.reason || "").trim();
  await row.update({ revert_status: "no" });
  await addAssetLog(row.id, req.user.id, "reject_edit", row.user_id, `Edit request rejected: ${reason}`);
  if (row.user_id) {
    await notifyAssetUser(row.user_id, `Edit Request Rejected: ${row.name}`, `Your edit request for asset '${row.name}' has been rejected. Reason: ${reason}`, row.id, {
      actor: req.user,
      intro: `Your request to edit asset "${row.name}" has been rejected.`,
      note: reason,
    });
  }
  return ok(res, await loadAsset(row.id), "Edit request rejected.");
});
