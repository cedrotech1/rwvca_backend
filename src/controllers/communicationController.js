import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import fileStorage from "../utils/fileStorage.js";

const { saveRequestFile } = fileStorage;

const FULL_ACCESS_ROLES = new Set(["ed", "chairman", "admin"]);

function parseUserIds(value) {
  return String(value || "")
    .split(",")
    .map((id) => Number(String(id).trim()))
    .filter(Boolean);
}

function canAccess(user, row) {
  if (hasFullAccess(user.role) || Number(row.created_by) === Number(user.id)) return true;
  return parseUserIds(row.users).includes(Number(user.id));
}

function hasFullAccess(role) {
  return FULL_ACCESS_ROLES.has(String(role || "").trim().toLowerCase());
}

function visibilityWhere(user) {
  if (hasFullAccess(user.role)) return {};
  const id = String(user.id);
  return {
    [Op.or]: [
      { created_by: user.id },
      { users: { [Op.iLike]: `%${id}%` } },
    ],
  };
}

function buildReplyTree(rows, parentId = 0, level = 0) {
  return rows
    .filter((row) => Number(row.parent_reply_id || 0) === Number(parentId))
    .map((row) => ({
      ...row,
      level,
      children: buildReplyTree(rows, row.id, level + 1),
    }));
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadCommunication(id) {
  const row = await db.Communications.findByPk(id, {
    include: [
      { model: db.Users, as: "creator", attributes: ["id", "names", "email", "role"] },
      {
        model: db.CommunicationReplies,
        as: "communication_replies_communication_id",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
      },
      { model: db.CommunicationAttachments, as: "communication_attachments_communication_id" },
    ],
    order: [[{ model: db.CommunicationReplies, as: "communication_replies_communication_id" }, "id", "ASC"]],
  });
  if (!row) return null;

  const json = row.toJSON();
  const recipientIds = parseUserIds(json.users);
  const viewedIds = parseUserIds(json.viewed_users);
  const users = recipientIds.length
    ? await db.Users.findAll({
        where: { id: recipientIds },
        attributes: ["id", "names", "email", "role"],
      })
    : [];

  return {
    ...json,
    recipient_users: users,
    viewed_user_ids: viewedIds,
    unread_user_ids: recipientIds.filter((userId) => !viewedIds.includes(userId)),
    viewed_users_detail: users.filter((user) => viewedIds.includes(Number(user.id))),
    unread_users_detail: users.filter((user) => !viewedIds.includes(Number(user.id))),
    threaded_replies: buildReplyTree(json.communication_replies_communication_id || []),
  };
}

export const getCommunications = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const search = String(req.query.search || "").trim();
  const tab = req.query.tab || "my";
  const communicationType = req.query.communication_type || "general";
  const where = { communication_type: communicationType };

  if (tab === "my") {
    where.created_by = req.user.id;
  } else if (tab === "received") {
    where.created_by = { [Op.ne]: req.user.id };
    where.users = { [Op.iLike]: `%${req.user.id}%` };
  } else if (!hasFullAccess(req.user.role)) {
    Object.assign(where, visibilityWhere(req.user));
  }

  if (req.query.created_by && req.query.created_by !== "all") where.created_by = req.query.created_by;
  if (req.query.date_from) {
    where.created_at = { ...(where.created_at || {}), [Op.gte]: `${req.query.date_from} 00:00:00` };
  }
  if (req.query.date_to) {
    where.created_at = { ...(where.created_at || {}), [Op.lte]: `${req.query.date_to} 23:59:59` };
  }
  if (req.query.exact_date) {
    where.created_at = {
      [Op.gte]: `${req.query.exact_date} 00:00:00`,
      [Op.lte]: `${req.query.exact_date} 23:59:59`,
    };
  }
  if (search) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ],
      },
    ];
  }

  const { rows, count } = await db.Communications.findAndCountAll({
    where,
    include: [
      { model: db.Users, as: "creator", attributes: ["id", "names", "email"] },
      { model: db.CommunicationReplies, as: "communication_replies_communication_id", attributes: ["id"], required: false },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  const items = rows.map((row) => {
    const json = row.toJSON();
    const recipientIds = parseUserIds(json.users);
    const viewedIds = parseUserIds(json.viewed_users);
    return {
      ...json,
      recipient_count: recipientIds.length,
      reply_count: Number(json.communication_replies_communication_id?.length || 0),
      is_read: viewedIds.includes(Number(req.user.id)),
      viewed_count: viewedIds.length,
      unread_count: Math.max(recipientIds.length - viewedIds.length, 0),
      description_preview: stripHtml(json.description).slice(0, 240),
    };
  });
  return ok(res, { items, pagination: paginationMeta(count, page, limit) });
});

export const getCommunication = asyncHandler(async (req, res) => {
  const row = await loadCommunication(req.params.id);
  if (!row) return fail(res, "Communication not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  return ok(res, row);
});

export const createCommunication = asyncHandler(async (req, res) => {
  const { title, description, users } = req.body || {};
  if (!title || !description || !users) {
    return fail(res, "title, description, and users are required");
  }
  const userList = Array.isArray(users) ? users : parseUserIds(users);
  let savedAttachment = null;
  try {
    savedAttachment = saveRequestFile(req, "communications", {
      prefix: "communication",
      fieldNames: ["attachment_url", "attachment", "file"],
    });
  } catch (error) {
    return fail(res, error.message);
  }

  const row = await db.Communications.create({
    title,
    description,
    users: userList.join(","),
    communication_type: req.body.communication_type || "general",
    created_by: req.user.id,
    start_time: req.body.start_time || null,
    end_time: req.body.end_time || null,
    attachment_url: savedAttachment?.dbPath || req.body.attachment_url || null,
    link: req.body.link || null,
  });
  if (savedAttachment?.dbPath) {
    await db.CommunicationAttachments.create({
      communication_id: row.id,
      type: savedAttachment.mimeType || "attachment",
      link: savedAttachment.dbPath,
    });
  }
  await createLog(req.user.id, "create_communication", `Created communication #${row.id}`);
  const loaded = await loadCommunication(row.id);
  await Promise.all(
    userList
      .filter((id) => Number(id) !== Number(req.user.id))
      .map((receiverId) =>
        createNotification({
      whatsapp: true,
          receiverId,
          type: row.communication_type === "permission" ? "permission" : "communication",
          title: row.communication_type === "permission" ? "New permission request" : "New communication",
          message: `${req.user.names}: ${title}`,
          link: `/communications/${row.id}`,
          emailPayload: buildEmailPayload("communication", loaded, {
            intro: row.communication_type === "permission"
              ? `${req.user.names} has sent you a new permission request.`
              : `${req.user.names} has sent you a new communication.`,
            actor: req.user,
            actionRequired: row.communication_type === "permission"
              ? "Please review the permission request and respond as appropriate."
              : undefined,
          }),
        })
      )
  );
  return created(res, loaded, "Communication created");
});

export const addCommunicationReply = asyncHandler(async (req, res) => {
  const parent = await db.Communications.findByPk(req.params.id);
  if (!parent) return fail(res, "Communication not found", 404);
  if (!canAccess(req.user, parent)) return fail(res, "Access denied", 403);
  const reply_text = String(req.body.reply_text || req.body.message || "").trim();
  if (!reply_text) return fail(res, "reply_text is required");
  const parent_reply_id = Number(req.body.parent_reply_id || 0) || null;
  const reply = await db.CommunicationReplies.create({
    communication_id: parent.id,
    user_id: req.user.id,
    reply_text,
    parent_reply_id,
    status: "active",
  });
  const notifyIds = [parent.created_by, ...parseUserIds(parent.users)].filter(
    (id) => Number(id) !== Number(req.user.id)
  );
  const loaded = await loadCommunication(parent.id);
  await Promise.all(
    [...new Set(notifyIds)].map((receiverId) =>
      createNotification({
      whatsapp: true,
        receiverId,
        type: parent.communication_type === "permission" ? "permission_reply" : "communication_reply",
        title: `Reply on '${parent.title}'`,
        message: reply_text.slice(0, 160),
        link: `/communications/${parent.id}`,
        emailPayload: buildEmailPayload("communication", loaded, {
          intro: `${req.user.names} replied to "${parent.title}".`,
          actor: req.user,
          note: reply_text,
        }),
      })
    )
  );
  return created(res, reply, "Reply added");
});

export const markCommunicationViewed = asyncHandler(async (req, res) => {
  const row = await db.Communications.findByPk(req.params.id);
  if (!row) return fail(res, "Communication not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  const viewed = parseUserIds(row.viewed_users);
  if (!viewed.includes(Number(req.user.id))) viewed.push(Number(req.user.id));
  await row.update({ viewed_users: viewed.join(",") });
  return ok(res, await loadCommunication(row.id), "Marked as viewed");
});

export const deleteCommunication = asyncHandler(async (req, res) => {
  const row = await db.Communications.findByPk(req.params.id);
  if (!row) return fail(res, "Communication not found", 404);
  if (!hasFullAccess(req.user.role) && Number(row.created_by) !== Number(req.user.id)) {
    return fail(res, "Access denied", 403);
  }
  await db.CommunicationReplies.destroy({ where: { communication_id: row.id } });
  await db.CommunicationAttachments.destroy({ where: { communication_id: row.id } });
  await row.destroy();
  await createLog(req.user.id, "delete_communication", `Deleted communication #${req.params.id}`);
  return ok(res, null, "Communication deleted");
});
