import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import path from "path";
import fs from "fs";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { requireNotificationPriority } from "../utils/notificationPriority.js";
import { isAdminRole, isEdRole } from "../utils/roleHelpers.js";
import fileStorage from "../utils/fileStorage.js";
const { saveRequestFile, resolveUploadFilePath } = fileStorage;

const ALLOWED_FILE_TYPES = ["pdf", "docx", "xlsx", "doc", "xls", "word", "excel"];

async function sharedIdsFor(userId) {
  const shares = await db.DocumentShares.findAll({
    where: { shared_to: userId },
    attributes: ["document_id"],
  });
  return shares.map((row) => row.document_id);
}

function buildCommentTree(comments) {
  const map = new Map();
  comments.forEach((row) => {
    const plain = row.get ? row.get({ plain: true }) : row;
    map.set(plain.id, { ...plain, children: [] });
  });
  const roots = [];
  map.forEach((node) => {
    if (node.parent_comment_id && map.has(node.parent_comment_id)) {
      map.get(node.parent_comment_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

async function canAccessDocument(user, document) {
  if (!document) return false;
  if (isEdRole(user.role)) return true;
  if (Number(document.created_by) === Number(user.id)) return true;
  const share = await db.DocumentShares.findOne({
    where: { document_id: document.id, shared_to: user.id },
  });
  return Boolean(share);
}

function canShareDocument(user, document) {
  return Number(document.created_by) === Number(user.id) || isEdRole(user.role);
}

function canDownloadDocument(user, document) {
  if (document.status === "open") return true;
  return isEdRole(user.role);
}

async function loadDocument(id) {
  return db.Documents.findByPk(id, {
    include: [
      {
        model: db.Users,
        as: "creator",
        attributes: ["id", "names", "email", "role", "department_ID"],
        include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
      },
      {
        model: db.DocumentShares,
        as: "document_shares_document_id",
        include: [
          { model: db.Users, as: "sharedByUser", attributes: ["id", "names", "email", "role"] },
          { model: db.Users, as: "sharedToUser", attributes: ["id", "names", "email", "role"] },
        ],
      },
      {
        model: db.DocumentComments,
        as: "document_comments_document_id",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
      },
    ],
    order: [[{ model: db.DocumentComments, as: "document_comments_document_id" }, "commented_at", "ASC"]],
  });
}

function decorateDocument(row, user) {
  const json = row.toJSON ? row.toJSON() : row;
  const shares = (json.document_shares_document_id || [])
    .map((share) => ({
      ...share,
      shared_to_name: share.sharedToUser?.names,
      shared_by_name: share.sharedByUser?.names,
      share_type: Number(share.is_forward) === 1 ? "forward" : "direct",
    }))
    .sort((a, b) => new Date(b.shared_at || 0) - new Date(a.shared_at || 0));
  const comments = json.document_comments_document_id || [];
  const myShare = shares.find((share) => Number(share.shared_to) === Number(user.id));
  return {
    ...json,
    creator_name: json.creator?.names,
    department_name: json.creator?.department?.name || null,
    shares,
    comments_flat: comments,
    comment_tree: buildCommentTree(comments),
    share_count: shares.length,
    my_share: myShare || null,
    can_share: canShareDocument(user, json),
    can_toggle_status: isEdRole(user.role),
    can_delete: Number(json.created_by) === Number(user.id),
    can_download: canDownloadDocument(user, json),
    is_open: json.status === "open",
  };
}

export const getDocuments = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req, { page: 1, limit: 100, max: 500 });
  const tab = req.query.tab || "mine";
  const search = String(req.query.search || "").trim();
  const where = {};

  if (tab === "mine") {
    where.created_by = req.user.id;
  } else if (tab === "shared") {
    const ids = await sharedIdsFor(req.user.id);
    where.id = ids.length ? ids : -1;
  } else if (tab === "all" && isEdRole(req.user.role)) {
    // ED sees every document
  } else {
    const ids = await sharedIdsFor(req.user.id);
    where[Op.or] = [{ created_by: req.user.id }, { id: ids.length ? ids : [-1] }];
  }

  if (req.query.type) where.type = req.query.type;
  if (req.query.status) where.status = req.query.status;
  if (search) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { type: { [Op.iLike]: `%${search}%` } },
        ],
      },
    ];
  }

  const { rows, count } = await db.Documents.findAndCountAll({
    where,
    include: [
      {
        model: db.Users,
        as: "creator",
        attributes: ["id", "names", "email"],
        include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
      },
      { model: db.DocumentShares, as: "document_shares_document_id", include: [
        { model: db.Users, as: "sharedToUser", attributes: ["id", "names", "email"], include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }] },
        { model: db.Users, as: "sharedByUser", attributes: ["id", "names", "email"], include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }] },
      ] },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  const items = rows.map((row) => {
    const json = row.toJSON();
    const shares = json.document_shares_document_id || [];
    const myShare = shares.find((share) => Number(share.shared_to) === Number(req.user.id));
    const creatorDepartment = json.creator?.department?.name || null;
    const sharedByDepartment = myShare?.sharedByUser?.department?.name || null;
    return {
      ...json,
      share_count: shares.length,
      shared_users: shares.map((share) => ({
        name: share.sharedToUser?.names,
        department: share.sharedToUser?.department?.name || "No Department",
        shared_date: share.shared_at,
        share_type: Number(share.is_forward) === 1 ? "forwarded" : "direct",
      })),
      shared_by_name: myShare?.sharedByUser?.names || null,
      shared_date: myShare?.shared_at || null,
      share_type: myShare ? (Number(myShare.is_forward) === 1 ? "forwarded" : "direct") : null,
      department_name: tab === "shared" ? sharedByDepartment : creatorDepartment,
      creator_name: json.creator?.names,
      can_download: json.status === "open" || isEdRole(req.user.role),
      can_delete: Number(json.created_by) === Number(req.user.id),
      can_toggle_status: isEdRole(req.user.role),
    };
  });
  return ok(res, { items, pagination: paginationMeta(count, page, limit) });
});

export const getDocumentTypes = asyncHandler(async (req, res) => {
  const rows = await db.Documents.findAll({
    attributes: [[db.sequelize.fn("DISTINCT", db.sequelize.col("type")), "type"]],
    where: { type: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] } },
    raw: true,
  });
  return ok(res, rows.map((row) => row.type).filter(Boolean));
});

export const getDocument = asyncHandler(async (req, res) => {
  const row = await loadDocument(req.params.id);
  if (!row) return fail(res, "Document not found", 404);
  if (!(await canAccessDocument(req.user, row))) return fail(res, "Access denied", 403);
  return ok(res, decorateDocument(row, req.user));
});

export const getDocumentShareUsers = asyncHandler(async (req, res) => {
  const row = await db.Documents.findByPk(req.params.id);
  if (!row) return fail(res, "Document not found", 404);
  if (!(await canAccessDocument(req.user, row))) return fail(res, "Access denied", 403);
  if (!canShareDocument(req.user, row)) return fail(res, "Only the creator or ED can share this document", 403);

  const dept = req.query.dept;
  if (dept === undefined || dept === null || String(dept).trim() === "") {
    return ok(res, []);
  }

  const excludeIds = [...new Set([Number(req.user.id), Number(row.created_by)].filter((id) => id > 0))];
  const where = {
    deleted: { [Op.ne]: "1" },
    id: { [Op.notIn]: excludeIds.length ? excludeIds : [0] },
  };
  if (String(dept) === "0") {
    where.department_ID = { [Op.or]: [null, 0] };
  } else {
    where.department_ID = Number(dept);
  }

  const users = await db.Users.findAll({
    where,
    attributes: ["id", "names", "email", "role", "department_ID"],
    order: [["names", "ASC"]],
  });
  return ok(res, users);
});

export const createDocument = asyncHandler(async (req, res) => {
  const title = String(req.body.title || "").trim();
  if (!title) return fail(res, "Title is required");

  let saved = null;
  try {
    saved = saveRequestFile(req, "documents", {
      prefix: null,
      fieldNames: ["document_file", "file", "attachment"],
    });
  } catch (error) {
    return fail(res, error.message);
  }

  const file_path = saved?.dbPath || req.body.file_path || null;
  if (!file_path) return fail(res, "Please select a file to upload.");

  const file_type = String(
    req.body.file_type || (saved?.originalName ? path.extname(saved.originalName).slice(1) : "pdf")
  ).toLowerCase();
  if (!ALLOWED_FILE_TYPES.includes(file_type)) {
    return fail(res, "Invalid file type. Allowed: PDF, DOCX, XLSX, DOC, XLS.");
  }
  const type = req.body.type === "custom" && req.body.custom_type ? req.body.custom_type : req.body.type || "general";
  const mappedType = file_type === "doc" ? "word" : file_type === "xls" ? "excel" : file_type;
  const row = await db.Documents.create({
    title,
    type,
    file_type: mappedType,
    file_path,
    description: req.body.description || null,
    status: "open",
    created_by: req.user.id,
  });
  await createLog(req.user.id, "create_document", `Created document #${row.id}`);
  return created(res, await loadDocument(row.id), "Document created");
});

export const updateDocument = asyncHandler(async (req, res) => {
  const row = await db.Documents.findByPk(req.params.id);
  if (!row) return fail(res, "Document not found", 404);
  if (Number(row.created_by) !== Number(req.user.id) && !isAdminRole(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  let saved = null;
  try {
    saved = saveRequestFile(req, "documents", {
      fieldNames: ["document_file", "file", "attachment"],
    });
  } catch (error) {
    return fail(res, error.message);
  }
  const nextPath = saved?.dbPath || req.body.file_path || row.file_path;
  const nextType = saved?.originalName
    ? path.extname(saved.originalName).slice(1).toLowerCase()
    : req.body.file_type || row.file_type;
  await row.update({
    title: req.body.title || row.title,
    type: req.body.type || row.type,
    description: req.body.description !== undefined ? req.body.description : row.description,
    status: req.body.status || row.status,
    file_path: nextPath,
    file_type: nextType === "doc" ? "word" : nextType === "xls" ? "excel" : nextType,
  });
  return ok(res, await loadDocument(row.id), "Document updated");
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const row = await loadDocument(req.params.id);
  if (!row) return fail(res, "Document not found", 404);
  if (!(await canAccessDocument(req.user, row))) return fail(res, "Access denied", 403);
  if (!canDownloadDocument(req.user, row)) {
    return fail(res, "This document is closed. You cannot download it.", 403);
  }
  const abs = resolveUploadFilePath(row.file_path);
  if (!abs || !fs.existsSync(abs)) return fail(res, "File not found", 404);
  const ext = path.extname(abs);
  const downloadName = `${String(row.title || "document").replace(/[\\/:*?"<>|]+/g, "_")}${ext}`;
  return res.download(abs, downloadName);
});

export const shareDocument = asyncHandler(async (req, res) => {
  const row = await db.Documents.findByPk(req.params.id);
  if (!row) return fail(res, "Document not found", 404);
  if (!(await canAccessDocument(req.user, row))) return fail(res, "Access denied", 403);
  if (!canShareDocument(req.user, row)) return fail(res, "Only the creator or ED can share this document", 403);

  const ids = Array.isArray(req.body.user_ids)
    ? req.body.user_ids
    : Array.isArray(req.body.share_to)
      ? req.body.share_to
      : req.body.share_to
        ? [].concat(req.body.share_to)
        : [];
  if (!ids.length) return fail(res, "Select at least one user to share with");
  const priority = requireNotificationPriority(req.body);
  if (!priority) return fail(res, "Select notification priority (Send as: Urgent / High / Middle / Low)");
  const is_forward = req.body.is_forward === true || req.body.is_forward === 1 || req.body.is_forward === "1" ? 1 : 0;

  let successCount = 0;
  let alreadyCount = 0;
  const notified = [];

  const loadedDoc = await loadDocument(row.id);

  for (const rawId of ids) {
    const share_to = Number(rawId);
    if (!share_to || share_to === Number(req.user.id) || share_to === Number(row.created_by)) continue;
    const existing = await db.DocumentShares.findOne({ where: { document_id: row.id, shared_to: share_to } });
    if (!existing) {
      await db.DocumentShares.create({
        document_id: row.id,
        shared_by: req.user.id,
        shared_to: share_to,
        shared_at: new Date(),
        is_forward,
      });
      successCount += 1;
    } else {
      alreadyCount += 1;
    }
    await createNotification({
      whatsapp: true,
      receiverId: share_to,
      type: "share",
      title: "New Document Shared",
      message: `${req.user.names} has shared document '${row.title}' with you.`,
      link: `/documents/${row.id}`,
      priority,
      emailPayload: buildEmailPayload("document", loadedDoc, {
        intro: `${req.user.names} has shared a document with you on the RWVCA portal.`,
        actor: req.user,
        sharedBy: req.user,
      }),
    });
    notified.push(share_to);
  }

  if (!successCount && !alreadyCount) return fail(res, "No users selected for sharing.");
  const loaded = await loadDocument(row.id);
  return ok(
    res,
    decorateDocument(loaded, req.user),
    `Document shared and emails sent to ${notified.length} user(s)!`
  );
});

export const updateDocumentStatus = asyncHandler(async (req, res) => {
  const row = await db.Documents.findByPk(req.params.id);
  if (!row) return fail(res, "Document not found", 404);
  if (!isEdRole(req.user.role)) return fail(res, "Only ED can change document status", 403);
  const newStatus = req.body.new_status === "open" || req.body.status === "open" ? "open" : "closed";
  await row.update({ status: newStatus });

  const loadedDoc = await loadDocument(row.id);

  await createNotification({
      whatsapp: true,
    receiverId: row.created_by,
    type: "status_update",
    title: "Document Status Updated",
    message: `The status of document '${row.title}' has been updated to '${newStatus}' by ${req.user.names}.`,
    link: `/documents/${row.id}`,
    emailPayload: buildEmailPayload("document", loadedDoc, {
      intro: `${req.user.names} has changed the status of your document to "${newStatus}".`,
      actor: req.user,
    }),
  });

  if (newStatus === "closed") {
    const shares = await db.DocumentShares.findAll({ where: { document_id: row.id } });
    await Promise.all(
      shares
        .filter((share) => Number(share.shared_to) !== Number(row.created_by))
        .map((share) =>
          createNotification({
      whatsapp: true,
            receiverId: share.shared_to,
            type: "access_revoked",
            title: "Document Access Revoked",
            message: `Access to document '${row.title}' has been revoked by ${req.user.names} as the document is now closed.`,
            link: `/documents/${row.id}`,
            emailPayload: buildEmailPayload("document", loadedDoc, {
              intro: `Access to the document "${row.title}" has been revoked because it was closed by ${req.user.names}.`,
              actor: req.user,
              note: "This document is no longer available for download unless you are the Executive Director.",
            }),
          })
        )
    );
  }

  await createLog(req.user.id, "update_document_status", `Set document #${row.id} to ${newStatus}`);
  return ok(res, decorateDocument(await loadDocument(row.id), req.user), `Document ${newStatus}`);
});

export const addDocumentComment = asyncHandler(async (req, res) => {
  const row = await db.Documents.findByPk(req.params.id);
  if (!row) return fail(res, "Document not found", 404);
  if (!(await canAccessDocument(req.user, row))) return fail(res, "Access denied", 403);
  const comment_text = String(req.body.comment_text || req.body.comment || "").trim();
  if (!comment_text) return fail(res, "comment_text is required");
  const parent = Number(req.body.parent_comment_id || req.body.parent_id || 0) || null;
  const comment = await db.DocumentComments.create({
    document_id: row.id,
    user_id: req.user.id,
    parent_comment_id: parent,
    comment_text,
    commented_at: new Date(),
  });
  const loadedDoc = await loadDocument(row.id);
  if (Number(row.created_by) !== Number(req.user.id)) {
    await createNotification({
      whatsapp: true,
      receiverId: row.created_by,
      type: "comment",
      title: "New Comment on Your Document",
      message: `${req.user.names} has commented on your document '${row.title}'.`,
      link: `/documents/${row.id}#comments`,
      emailPayload: buildEmailPayload("document", loadedDoc, {
        intro: `${req.user.names} added a comment on your document "${row.title}".`,
        actor: req.user,
        note: comment_text,
      }),
    });
  }
  if (parent) {
    const parentComment = await db.DocumentComments.findByPk(parent);
    if (parentComment && Number(parentComment.user_id) !== Number(req.user.id)) {
      await createNotification({
      whatsapp: true,
        receiverId: parentComment.user_id,
        type: "reply",
        title: "Reply to Your Comment",
        message: `${req.user.names} has replied to your comment on '${row.title}'.`,
        link: `/documents/${row.id}#comments`,
        emailPayload: buildEmailPayload("document", loadedDoc, {
          intro: `${req.user.names} replied to your comment on "${row.title}".`,
          actor: req.user,
          note: comment_text,
        }),
      });
    }
  }
  const loaded = await loadDocument(row.id);
  return created(res, decorateDocument(loaded, req.user), "Comment added");
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const row = await db.Documents.findByPk(req.params.id);
  if (!row) return fail(res, "Document not found", 404);
  if (Number(row.created_by) !== Number(req.user.id) && !isAdminRole(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  await db.DocumentComments.destroy({ where: { document_id: row.id } });
  await db.DocumentShares.destroy({ where: { document_id: row.id } });
  await row.destroy();
  await createLog(req.user.id, "delete_document", `Deleted document #${req.params.id}`);
  return ok(res, null, "Document deleted");
});
