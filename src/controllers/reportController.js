import fs from "fs";
import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { requireNotificationPriority } from "../utils/notificationPriority.js";
import { isAdminRole, isExecutiveRole } from "../utils/roleHelpers.js";
import fileStorage from "../utils/fileStorage.js";

const { saveRequestFile, saveRequestFiles, resolveUploadFilePath } = fileStorage;
const Reports = db.Reports;

function parseRecipientIds(body) {
  const raw = body?.recipient_ids;
  if (Array.isArray(raw)) return [...new Set(raw.map((id) => Number(id)).filter(Boolean))];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return [...new Set(parsed.map((id) => Number(id)).filter(Boolean))];
    } catch {
      return [...new Set(
        raw.split(",")
          .map((part) => Number(String(part).replace(/^user:/, "").trim()))
          .filter(Boolean)
      )];
    }
  }
  return [];
}

function buildCommentTree(comments) {
  const map = new Map();
  comments.forEach((row) => {
    const plain = row.get ? row.get({ plain: true }) : row;
    map.set(plain.id, { ...plain, children: [] });
  });
  const roots = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) map.get(node.parent_id).children.push(node);
    else roots.push(node);
  });
  return roots;
}

async function canAccessReport(user, report) {
  if (!report) return false;
  if (isExecutiveRole(user.role) || isAdminRole(user.role)) return true;
  if (Number(report.created_by) === Number(user.id)) return true;
  const recipient = await db.ReportRecipient.findOne({
    where: { report_id: report.id, recipient_type: "user", recipient_id: user.id },
  });
  return Boolean(recipient);
}

async function notifyReportRecipients({
  report,
  sender,
  recipientIds,
  titlePrefix = "New Report Shared",
  priority = "middle",
}) {
  const link = `/reports/${report.id}?tab=shared`;
  await Promise.all(
    recipientIds.map((receiverId) =>
      createNotification({
      whatsapp: true,
        receiverId,
        type: "report",
        title: `${titlePrefix}: ${report.title}`,
        message: `A new ${report.type} report titled '${report.title}' has been assigned to you for review.`,
        link,
        priority,
        emailPayload: buildEmailPayload("report", report, {
          intro: `${sender.names} has shared a ${report.type} report with you for review.`,
          actor: sender,
          sender,
          actionRequired: "Please review the report details and add your comments if needed.",
        }),
      })
    )
  );
}

async function notifyReplyAudience({ report, sender, parentId, commentId, replyContent }) {
  const ids = new Set();
  if (Number(report.created_by) !== Number(sender.id)) ids.add(Number(report.created_by));
  if (parentId) {
    const parent = await db.ReportComments.findByPk(parentId, { attributes: ["created_by"] });
    if (parent?.created_by && Number(parent.created_by) !== Number(sender.id)) ids.add(Number(parent.created_by));
  }
  const recipients = await db.ReportRecipient.findAll({
    where: { report_id: report.id, recipient_type: "user" },
    attributes: ["recipient_id"],
  });
  recipients.forEach((row) => {
    if (Number(row.recipient_id) !== Number(sender.id)) ids.add(Number(row.recipient_id));
  });
  const link = `/reports/${report.id}#comment-${commentId}`;
  await Promise.all(
    [...ids].map((receiverId) =>
      createNotification({
      whatsapp: true,
        receiverId,
        type: "report",
        title: `New Reply to Report: ${report.title}`,
        message: `A new reply was added to '${report.title}' by ${sender.names}.`,
        link,
        emailPayload: buildEmailPayload("report", report, {
          intro: `${sender.names} added a reply to the report "${report.title}".`,
          actor: sender,
          sender,
          note: replyContent,
        }),
      })
    )
  );
}

async function enrichRecipients(rows) {
  const userIds = rows.filter((r) => r.recipient_type === "user").map((r) => r.recipient_id);
  const users = userIds.length
    ? await db.Users.findAll({
        where: { id: userIds },
        attributes: ["id", "names", "email", "role", "department_ID"],
        include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
      })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  return rows.map((row) => {
    const plain = row.get ? row.get({ plain: true }) : row;
    const user = plain.recipient_type === "user" ? userMap[plain.recipient_id] : null;
    return {
      ...plain,
      recipient_name: user?.names || null,
      recipient_role: user?.role || null,
      dept_name: user?.department?.name || null,
    };
  });
}

export const getReports = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req, { limit: 20 });
  const tab = req.query.tab || "my";
  const search = String(req.query.search || "").trim();
  const where = {};

  if (tab === "shared") {
    const recips = await db.ReportRecipient.findAll({
      where: { recipient_type: "user", recipient_id: req.user.id },
      attributes: ["report_id", "read_status"],
    });
    const reportIds = recips.map((row) => row.report_id);
    where.id = reportIds.length ? reportIds : -1;
    if (req.query.filter_status === "read") {
      const readIds = recips.filter((r) => Number(r.read_status) === 1).map((r) => r.report_id);
      where.id = readIds.length ? readIds : -1;
    } else if (req.query.filter_status === "unread") {
      const unreadIds = recips.filter((r) => Number(r.read_status) !== 1).map((r) => r.report_id);
      where.id = unreadIds.length ? unreadIds : -1;
    }
  } else {
    where.created_by = req.user.id;
  }

  const typeFilter = req.query.type || req.query.filter_type;
  if (typeFilter) where.type = typeFilter;
  if (req.query.created_by) where.created_by = req.query.created_by;
  if (req.query.filter_creator) where.created_by = req.query.filter_creator;
  if (req.query.date_from) {
    where.created_at = { ...(where.created_at || {}), [Op.gte]: `${req.query.date_from} 00:00:00` };
  }
  if (req.query.date_to) {
    where.created_at = { ...(where.created_at || {}), [Op.lte]: `${req.query.date_to} 23:59:59` };
  }
  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { content: { [Op.iLike]: `%${search}%` } },
    ];
  }

  let reportIdsForRecipientFilter = null;
  if (req.query.filter_recipient) {
    const matches = await db.ReportRecipient.findAll({
      where: { recipient_type: "user", recipient_id: req.query.filter_recipient },
      attributes: ["report_id"],
    });
    reportIdsForRecipientFilter = matches.map((row) => row.report_id);
    where.id = where.id
      ? { [Op.and]: [where.id, reportIdsForRecipientFilter.length ? reportIdsForRecipientFilter : -1] }
      : (reportIdsForRecipientFilter.length ? reportIdsForRecipientFilter : -1);
  }

  const sort = ["id", "title", "type", "created_at"].includes(req.query.sort) ? req.query.sort : "created_at";
  const orderDir = String(req.query.order || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

  const { rows, count } = await Reports.findAndCountAll({
    where,
    include: [
      { model: db.Users, as: "creator", attributes: ["id", "names", "email", "role"] },
      { model: db.ReportRecipient, as: "report_recipient_report_id", attributes: ["id", "recipient_id", "recipient_type", "read_status"] },
      { model: db.ReportComments, as: "report_comments_report_id", attributes: ["id"] },
    ],
    order: [[sort, orderDir]],
    limit,
    offset,
    distinct: true,
  });

  const sharedReadMap = tab === "shared"
    ? Object.fromEntries(
        (await db.ReportRecipient.findAll({
          where: { recipient_type: "user", recipient_id: req.user.id },
          attributes: ["report_id", "read_status"],
        })).map((row) => [row.report_id, Number(row.read_status) === 1])
      )
    : {};

  const allRecipientUserIds = [...new Set(
    rows.flatMap((row) => (row.report_recipient_report_id || [])
      .filter((r) => r.recipient_type === "user")
      .map((r) => r.recipient_id))
  )];
  const recipientUsers = allRecipientUserIds.length
    ? await db.Users.findAll({ where: { id: allRecipientUserIds }, attributes: ["id", "names"] })
    : [];
  const recipientNameMap = Object.fromEntries(recipientUsers.map((u) => [u.id, u.names]));

  const items = rows.map((row) => {
    const json = row.toJSON();
    const recipientRows = json.report_recipient_report_id || [];
    const sharedNames = recipientRows
      .filter((r) => r.recipient_type === "user")
      .map((r) => recipientNameMap[r.recipient_id])
      .filter(Boolean);
    return {
      ...json,
      creator_name: json.creator?.names,
      replies: (json.report_comments_report_id || []).length,
      shared_with: sharedNames.join(", "),
      read_status: tab === "shared" ? (sharedReadMap[json.id] ? 1 : 0) : null,
      recipients: recipientRows,
      comments: json.report_comments_report_id || [],
    };
  });

  return ok(res, { items, pagination: paginationMeta(count, page, limit) });
});

export const getReport = asyncHandler(async (req, res) => {
  const report = await Reports.findByPk(req.params.id, {
    include: [
      { model: db.Users, as: "creator", attributes: ["id", "names", "email", "role"] },
      { model: db.ReportAttachments, as: "report_attachments_report_id" },
      {
        model: db.ReportComments,
        as: "report_comments_report_id",
        include: [{ model: db.Users, as: "creator", attributes: ["id", "names", "email", "role"] }],
        order: [["created_at", "ASC"]],
      },
      { model: db.ReportRecipient, as: "report_recipient_report_id" },
    ],
  });
  if (!report) return fail(res, "Report not found", 404);
  if (!(await canAccessReport(req.user, report))) return fail(res, "Access denied", 403);

  const recipient = await db.ReportRecipient.findOne({
    where: { report_id: report.id, recipient_type: "user", recipient_id: req.user.id },
  });
  if (recipient && Number(recipient.read_status) !== 1) {
    await recipient.update({ read_status: 1, read_at: new Date() });
  }

  const plain = report.toJSON();
  const comments = plain.report_comments_report_id || [];
  const recipients = await enrichRecipients(plain.report_recipient_report_id || []);

  return ok(res, {
    ...plain,
    creator_name: plain.creator?.names,
    attachments: plain.report_attachments_report_id || [],
    recipients,
    comments_flat: comments.map((c) => ({
      ...c,
      author: c.creator?.names,
      author_role: c.creator?.role,
    })),
    comment_tree: buildCommentTree(comments),
    can_delete: Number(plain.created_by) === Number(req.user.id),
  });
});

export const createReport = asyncHandler(async (req, res) => {
  const { title, type, content } = req.body || {};
  if (!title || !type || !content) return fail(res, "Title, Type and Content are required");

  const report = await Reports.create({
    title: String(title).trim(),
    type: String(type).trim(),
    content: String(content).trim(),
    time_from: req.body.time_from || null,
    time_to: req.body.time_to || null,
    location: req.body.location || null,
    period_start: req.body.period_start || null,
    period_end: req.body.period_end || null,
    created_by: req.user.id,
  });

  const recipientIds = parseRecipientIds(req.body).filter((id) => id !== req.user.id);
  if (recipientIds.length) {
    const priority = requireNotificationPriority(req.body);
    if (!priority) return fail(res, "Select notification priority (Send as: Urgent / High / Middle / Low)");
    await db.ReportRecipient.bulkCreate(
      recipientIds.map((recipient_id) => ({
        report_id: report.id,
        recipient_type: "user",
        recipient_id,
        assigned_at: new Date(),
      }))
    );
    await notifyReportRecipients({
      report,
      sender: req.user,
      recipientIds,
      titlePrefix: "New Report Shared",
      priority,
    });
  }

  const uploads = saveRequestFiles(req, "reports", {
    prefix: "report",
    fieldNames: ["attachments", "attachment", "file", "document_file"],
  });
  if (uploads.length) {
    await db.ReportAttachments.bulkCreate(
      uploads.map((saved) => ({
        report_id: report.id,
        file_name: saved.originalName,
        file_path: saved.dbPath,
        uploaded_by: req.user.id,
        mime_type: saved.mimeType,
        file_size: saved.size,
        uploaded_at: new Date(),
      }))
    );
  }

  await createLog(req.user.id, "create_report", `Created report #${report.id}: ${report.title}`);
  return created(res, report, "Report created successfully");
});

export const updateReport = asyncHandler(async (req, res) => {
  const report = await Reports.findByPk(req.params.id);
  if (!report) return fail(res, "Report not found", 404);
  if (Number(report.created_by) !== Number(req.user.id) && !isAdminRole(req.user.role)) {
    return fail(res, "You do not have permission to update this report", 403);
  }
  const body = { ...req.body };
  delete body.created_by;
  delete body.recipient_ids;
  await report.update(body);
  await createLog(req.user.id, "update_report", `Updated report #${report.id}`);
  return ok(res, report, "Report updated");
});

export const deleteReport = asyncHandler(async (req, res) => {
  const report = await Reports.findByPk(req.params.id);
  if (!report) return fail(res, "Report not found", 404);
  if (Number(report.created_by) !== Number(req.user.id)) {
    return fail(res, "You do not have permission to delete this report", 403);
  }

  const attachments = await db.ReportAttachments.findAll({ where: { report_id: report.id } });
  attachments.forEach((att) => {
    try {
      const abs = resolveUploadFilePath(att.file_path);
      if (abs && fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch { /* ignore */ }
  });

  await db.ReportComments.destroy({ where: { report_id: report.id } });
  await db.ReportAttachments.destroy({ where: { report_id: report.id } });
  await db.ReportRecipient.destroy({ where: { report_id: report.id } });
  await report.destroy();
  await createLog(req.user.id, "delete_report", `Deleted report #${report.id}: ${report.title}`);
  return ok(res, null, `Report "${report.title}" has been deleted permanently`);
});

export const addReportComment = asyncHandler(async (req, res) => {
  const report = await Reports.findByPk(req.params.id);
  if (!report) return fail(res, "Report not found", 404);
  if (!(await canAccessReport(req.user, report))) return fail(res, "Access denied", 403);
  const content = String(req.body.content || req.body.comment || "").trim();
  if (!content) return fail(res, "content is required");
  const parentId = req.body.parent_id ? Number(req.body.parent_id) : null;

  const comment = await db.ReportComments.create({
    report_id: report.id,
    parent_id: parentId,
    content,
    created_by: req.user.id,
  });

  await notifyReplyAudience({
    report,
    sender: req.user,
    parentId,
    commentId: comment.id,
    replyContent: content,
  });

  await createLog(req.user.id, "report_reply", `Added reply on report #${report.id}`);
  return created(res, comment, "Reply added");
});

export const addReportAttachment = asyncHandler(async (req, res) => {
  const report = await Reports.findByPk(req.params.id);
  if (!report) return fail(res, "Report not found", 404);
  if (Number(report.created_by) !== Number(req.user.id) && !isAdminRole(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  let file_name = req.body.file_name;
  let file_path = req.body.file_path;
  let mime_type = req.body.mime_type || null;
  let file_size = req.body.file_size || 0;
  try {
    const saved = saveRequestFile(req, "reports", { prefix: "report", fieldNames: ["file", "attachment", "document_file", "attachments"] });
    if (saved) {
      file_name = saved.originalName;
      file_path = saved.dbPath;
      mime_type = saved.mimeType;
      file_size = saved.size;
    }
  } catch (error) {
    return fail(res, error.message);
  }
  if (!file_name || !file_path) return fail(res, "Please upload a file");
  const attachment = await db.ReportAttachments.create({
    report_id: report.id,
    file_name,
    file_path,
    uploaded_by: req.user.id,
    mime_type,
    file_size,
    uploaded_at: new Date(),
  });
  return created(res, attachment, "Attachment added");
});

export const markReportRead = asyncHandler(async (req, res) => {
  const report = await Reports.findByPk(req.params.id);
  if (!report) return fail(res, "Report not found", 404);
  const recipient = await db.ReportRecipient.findOne({
    where: { report_id: report.id, recipient_type: "user", recipient_id: req.user.id },
  });
  if (!recipient) return fail(res, "You are not a recipient of this report", 403);
  await recipient.update({ read_status: 1, read_at: new Date() });
  return ok(res, recipient, "Marked as read");
});
