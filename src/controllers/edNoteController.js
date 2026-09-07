import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { requireNotificationPriority } from "../utils/notificationPriority.js";
import { isEdRole, isAdminRole } from "../utils/roleHelpers.js";

const commentInclude = [
  { model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] },
  {
    model: db.EdCommentRecipients,
    as: "recipients",
    include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
  },
  {
    model: db.EdModuleComments,
    as: "replies",
    include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
  },
];

async function loadNote(id) {
  return db.EdModuleComments.findByPk(id, {
    include: commentInclude,
    order: [[{ model: db.EdModuleComments, as: "replies" }, "id", "ASC"]],
  });
}

export const getEdNotes = asyncHandler(async (req, res) => {
  const isEd = isEdRole(req.user.role) || isAdminRole(req.user.role);
  const pendingOnly = req.query.filter === "unreplied" || req.query.filter === "unseen";
  let where = { parent_id: null };
  if (req.query.module_type) where.module_type = req.query.module_type;
  if (req.query.record_id) where.record_id = req.query.record_id;

  if (isEd) {
    where.user_id = req.user.id;
  } else {
    const assigned = await db.EdCommentRecipients.findAll({
      where: { user_id: req.user.id },
      attributes: ["comment_id"],
    });
    where.id = assigned.map((row) => row.comment_id);
    if (pendingOnly) {
      const unreplied = await db.EdCommentRecipients.findAll({
        where: { user_id: req.user.id, replied_at: null },
        attributes: ["comment_id"],
      });
      where.id = unreplied.map((row) => row.comment_id);
    }
  }

  const items = await db.EdModuleComments.findAll({
    where,
    include: commentInclude,
    order: [["created_at", "DESC"]],
  });
  return ok(res, items);
});

export const getEdNote = asyncHandler(async (req, res) => {
  const row = await loadNote(req.params.id);
  if (!row) return fail(res, "ED note not found", 404);
  if (isEdRole(req.user.role) || isAdminRole(req.user.role)) {
    await db.EdCommentEdSeen.findOrCreate({
      where: { ed_user_id: req.user.id, root_comment_id: row.id },
      defaults: {
        module_type: row.module_type,
        record_id: row.record_id,
        seen_at: new Date(),
      },
    });
  }
  return ok(res, row);
});

export const createEdNote = asyncHandler(async (req, res) => {
  if (!isEdRole(req.user.role) && !isAdminRole(req.user.role)) {
    return fail(res, "Only the Executive Director can create ED notes", 403);
  }
  if (!req.body.module_type || !req.body.record_id || !req.body.message) {
    return fail(res, "module_type, record_id, and message are required");
  }
  const recipientIds = Array.isArray(req.body.recipient_ids) ? req.body.recipient_ids : [];
  if (!recipientIds.length) return fail(res, "recipient_ids is required");
  const priority = requireNotificationPriority(req.body);
  if (!priority) return fail(res, "Select notification priority (Send as: Urgent / High / Middle / Low)");

  const row = await db.EdModuleComments.create({
    module_type: req.body.module_type,
    record_id: req.body.record_id,
    parent_id: null,
    user_id: req.user.id,
    message: req.body.message,
  });
  await db.EdCommentRecipients.bulkCreate(
    recipientIds.map((user_id) => ({
      comment_id: row.id,
      user_id,
      module_type: row.module_type,
      record_id: row.record_id,
    }))
  );
  await Promise.all(
    recipientIds.map((receiverId) =>
      createNotification({
      whatsapp: true,
        receiverId,
        type: "ed_note",
        title: "New ED note",
        message: req.body.message.slice(0, 160),
        link: `/ed-notes/${row.id}`,
        priority,
        emailPayload: buildEmailPayload("ed_note", {
          id: row.id,
          title: `${row.module_type} #${row.record_id}`,
          module: row.module_type,
          message: row.message,
        }, {
          intro: `${req.user.names} has sent you an Executive Director note that requires your attention.`,
          actor: req.user,
          note: req.body.message,
          actionRequired: "Please read the note below and respond when required.",
        }),
      })
    )
  );
  return created(res, await loadNote(row.id), "ED note created");
});

export const replyEdNote = asyncHandler(async (req, res) => {
  const parent = await db.EdModuleComments.findByPk(req.params.id);
  if (!parent) return fail(res, "ED note not found", 404);
  const message = String(req.body.message || "").trim();
  if (!message) return fail(res, "message is required");
  const reply = await db.EdModuleComments.create({
    module_type: parent.module_type,
    record_id: parent.record_id,
    parent_id: parent.id,
    user_id: req.user.id,
    message,
  });
  await db.EdCommentRecipients.update(
    { replied_at: new Date() },
    { where: { comment_id: parent.id, user_id: req.user.id } }
  );
  await createNotification({
      whatsapp: true,
    receiverId: parent.user_id,
    type: "ed_note_reply",
    title: "Reply on your ED note",
    message: message.slice(0, 160),
    link: `/ed-notes/${parent.id}`,
    emailPayload: buildEmailPayload("ed_note", {
      id: parent.id,
      title: `${parent.module_type} #${parent.record_id}`,
      module: parent.module_type,
      message: parent.message,
    }, {
      intro: `${req.user.names} replied to your Executive Director note.`,
      actor: req.user,
      note: message,
    }),
  });
  return created(res, reply, "Reply added");
});
