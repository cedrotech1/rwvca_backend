import asyncHandler from "express-async-handler";
import { ok, fail, created } from "../utils/apiResponse.js";
import {
  ED_VALID_TABS,
  fetchEdSummary,
  fetchModuleRecords,
  fetchCommentCounts,
} from "../services/edFullAccessService.js";
import {
  buildNotifyCandidates,
  canUseEdComments,
  getEdUserIds,
  getModuleRecordLabel,
  notifySelectedUsers,
  searchNotifyUsers,
} from "../services/edCommentService.js";
import db from "../database/models/index.js";
import { isExecutiveRole } from "../utils/roleHelpers.js";

export const getEdFullAccessSummary = asyncHandler(async (_req, res) => {
  const summary = await fetchEdSummary();
  return ok(res, { summary, tabs: ED_VALID_TABS });
});

export const getEdFullAccessModule = asyncHandler(async (req, res) => {
  const tab = String(req.params.tab || "").trim();
  if (!ED_VALID_TABS.includes(tab) || tab === "overview") {
    return fail(res, "Invalid module tab", 400);
  }
  const rows = await fetchModuleRecords(tab);
  const comment_counts = await fetchCommentCounts(tab);
  return ok(res, { tab, rows, comment_counts });
});

export const listModuleComments = asyncHandler(async (req, res) => {
  const module = String(req.query.module || "").trim();
  const recordId = Number(req.query.record_id || 0);
  if (!module || !recordId) return fail(res, "module and record_id are required");

  const comments = await db.EdModuleComments.findAll({
    where: { module_type: module, record_id: recordId },
    include: [{ model: db.Users, as: "user", attributes: ["id", "names", "role"] }],
    order: [["created_at", "ASC"]],
  });

  const label = await getModuleRecordLabel(module, recordId);
  const recipients = canUseEdComments(req.user.role)
    ? await buildNotifyCandidates(module, recordId, req.user.id)
    : [];

  return ok(res, {
    comments: comments.map((c) => ({
      id: c.id,
      parent_id: c.parent_id,
      user_id: c.user_id,
      message: c.message,
      created_at: c.created_at,
      author_name: c.user?.names,
      author_role: c.user?.role,
    })),
    label,
    default_title: `Note on ${label}`,
    recipients,
    staff_mode: !canUseEdComments(req.user.role),
  });
});

export const getNotifyRecipients = asyncHandler(async (req, res) => {
  if (!canUseEdComments(req.user.role)) return fail(res, "Recipients list is for ED/HR only", 403);
  const module = String(req.query.module || "").trim();
  const recordId = Number(req.query.record_id || 0);
  const parentId = req.query.parent_id ? Number(req.query.parent_id) : null;
  if (!module || !recordId) return fail(res, "module and record_id are required");

  let parentAuthorId = null;
  if (parentId) {
    const parent = await db.EdModuleComments.findByPk(parentId, { attributes: ["user_id"] });
    parentAuthorId = parent?.user_id;
  }

  const label = await getModuleRecordLabel(module, recordId);
  const recipients = await buildNotifyCandidates(module, recordId, req.user.id, parentAuthorId);
  return ok(res, {
    label,
    default_title: parentId ? `Reply on ${label}` : `Note on ${label}`,
    recipients,
  });
});

export const searchEdNotifyUsers = asyncHandler(async (req, res) => {
  if (!canUseEdComments(req.user.role)) return fail(res, "Not authorized", 403);
  const users = await searchNotifyUsers(req.query.q, req.user.id);
  return ok(res, users);
});

export const addModuleComment = asyncHandler(async (req, res) => {
  const module = String(req.body.module || "").trim();
  const recordId = Number(req.body.record_id || 0);
  const message = String(req.body.message || "").trim();
  const notifyTitle = String(req.body.notify_title || "").trim();
  const parentId = req.body.parent_id ? Number(req.body.parent_id) : null;
  const notifyIds = Array.isArray(req.body.notify_ids)
    ? [...new Set(req.body.notify_ids.map((id) => Number(id)).filter(Boolean))]
    : [];
  const isStaff = !canUseEdComments(req.user.role);

  if (!module || !recordId || !message) return fail(res, "module, record_id, and message are required");

  if (isStaff) {
    if (!parentId) return fail(res, "Staff can only reply to ED notes", 403);
    if (!notifyIds.length) {
      const edIds = await getEdUserIds();
      notifyIds.push(...edIds);
    }
  } else if (!notifyIds.length) {
    return fail(res, "Select at least one person to notify");
  }

  const row = await db.EdModuleComments.create({
    module_type: module,
    record_id: recordId,
    parent_id: parentId || null,
    user_id: req.user.id,
    message,
  });

  const title = notifyTitle || (parentId ? `Reply from ${req.user.names}` : `Note on ${await getModuleRecordLabel(module, recordId)}`);

  try {
    const notified = await notifySelectedUsers({
      senderId: req.user.id,
      senderName: req.user.names,
      module,
      recordId,
      message,
      notifyIds,
      notifyTitle: title,
      parentId,
      commentId: row.id,
    });
    return created(res, {
      id: row.id,
      notified,
      notified_count: notified.length,
    }, "Comment posted");
  } catch (error) {
    return created(res, {
      id: row.id,
      notified: [],
      notified_count: 0,
      warning: `Comment saved but notification failed: ${error.message}`,
    }, "Comment posted with warning");
  }
});

export const markEdThreadSeen = asyncHandler(async (req, res) => {
  if (!isExecutiveRole(req.user.role)) return fail(res, "ED only", 403);
  const module = String(req.body.module || "").trim();
  const recordId = Number(req.body.record_id || 0);
  const commentId = Number(req.body.comment_id || 0);
  if (!module || !recordId || !commentId) return fail(res, "Invalid parameters");

  const root = await db.EdModuleComments.findOne({
    where: {
      id: commentId,
      user_id: req.user.id,
      module_type: module,
      record_id: recordId,
      parent_id: null,
    },
  });
  if (!root) return fail(res, "Note not found", 404);

  await db.EdCommentEdSeen.findOrCreate({
    where: { ed_user_id: req.user.id, root_comment_id: commentId },
    defaults: { module_type: module, record_id: recordId, seen_at: new Date() },
  });

  return ok(res, null, "Marked as seen");
});
