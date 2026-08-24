import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import fileStorage from "../utils/fileStorage.js";
import { isAdminRole, isExactHr } from "../utils/roleHelpers.js";

const STATUSES = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const { saveRequestFile } = fileStorage;

function parseAttachment(value) {
  if (!value) return null;
  const [storedPath, originalName] = String(value).split("|");
  if (!storedPath) return null;
  return {
    stored_path: storedPath,
    name: originalName || storedPath.split("/").pop(),
  };
}

function decorateTicket(row) {
  if (!row) return row;
  const json = typeof row.toJSON === "function" ? row.toJSON() : row;
  return {
    ...json,
    attachment_files: json.attachments ? String(json.attachments).split(",").map((item) => parseAttachment(item)).filter(Boolean) : [],
    ticket_replies_ticket_id: (json.ticket_replies_ticket_id || []).map((reply) => ({
      ...reply,
      attachment_files: reply.attachments ? String(reply.attachments).split(",").map((item) => parseAttachment(item)).filter(Boolean) : [],
    })),
  };
}

async function notifyUsers(userIds, payload) {
  const unique = [...new Set((userIds || []).map(Number).filter(Boolean))];
  await Promise.all(unique.map((receiverId) => createNotification({
    whatsapp: true,
    receiverId,
    ...payload,
  })));
}

async function adminsAndHr(excludeId = null) {
  return db.Users.findAll({
    where: {
      [Op.or]: [{ role: { [Op.iLike]: "admin" } }, { role: { [Op.iLike]: "hr" } }],
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
    attributes: ["id", "names", "email", "role"],
  });
}

async function addTicketLog(ticketId, userId, action, details) {
  await db.TicketLogs.create({
    ticket_id: ticketId,
    user_id: userId,
    action,
    details: details || null,
  });
}

async function loadTicket(id) {
  return db.Tickets.findByPk(id, {
    include: [
      { model: db.Users, as: "creator", attributes: ["id", "names", "email", "role"] },
      { model: db.Users, as: "assignee", attributes: ["id", "names", "email", "role"] },
      {
        model: db.TicketReplies,
        as: "ticket_replies_ticket_id",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
      },
      {
        model: db.TicketLogs,
        as: "ticket_logs_ticket_id",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
      },
    ],
    order: [[{ model: db.TicketReplies, as: "ticket_replies_ticket_id" }, "id", "ASC"]],
  });
}

function canAccess(user, row) {
  if (isAdminRole(user.role) || isExactHr(user.role)) return true;
  return Number(row.created_by) === Number(user.id) || Number(row.assigned_to) === Number(user.id);
}

export const getTickets = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const tab = req.query.tab || "mine";
  const where = {};
  if (tab === "mine" || tab === "my_tickets") where.created_by = req.user.id;
  else if (tab === "assigned") where.assigned_to = req.user.id;
  else if (tab === "open") where.status = { [Op.in]: ["open", "in_progress", "pending"] };
  else if (tab === "all" && (isAdminRole(req.user.role) || isExactHr(req.user.role))) {
    // no filter
  } else {
    where[Op.or] = [{ created_by: req.user.id }, { assigned_to: req.user.id }];
  }
  if (req.query.status) where.status = req.query.status;
  if (req.query.priority) where.priority = req.query.priority;
  if (req.query.search) where.title = { [Op.iLike]: `%${req.query.search}%` };

  const { rows, count } = await db.Tickets.findAndCountAll({
    where,
    include: [
      { model: db.Users, as: "creator", attributes: ["id", "names", "email"] },
      { model: db.Users, as: "assignee", attributes: ["id", "names", "email"] },
      { model: db.TicketReplies, as: "ticket_replies_ticket_id", attributes: ["id"] },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return ok(res, { items: rows.map((row) => {
    const json = row.toJSON();
    return { ...json, replies: json.ticket_replies_ticket_id || [], reply_count: (json.ticket_replies_ticket_id || []).length };
  }), pagination: paginationMeta(count, page, limit) });
});

export const getTicket = asyncHandler(async (req, res) => {
  const row = await loadTicket(req.params.id);
  if (!row) return fail(res, "Ticket not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  return ok(res, decorateTicket(row));
});

export const createTicket = asyncHandler(async (req, res) => {
  const { title, description } = req.body || {};
  if (!title || !description) return fail(res, "title and description are required");
  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : "medium";
  let saved = null;
  try {
    saved = saveRequestFile(req, "tickets", { prefix: "ticket", fieldNames: ["attachment", "file"] });
  } catch (error) {
    return fail(res, error.message);
  }
  const attachmentValue = saved ? `${saved.dbPath}|${saved.originalName}` : null;
  const row = await db.Tickets.create({
    title,
    description,
    created_by: req.user.id,
    assigned_to: req.body.assigned_to || null,
    status: "open",
    priority,
    category: String(req.body.category || "general").toLowerCase(),
    attachments: attachmentValue,
  });
  await db.TicketReplies.create({
    ticket_id: row.id,
    user_id: req.user.id,
    message: description,
  });
  await addTicketLog(row.id, req.user.id, "created", "Ticket opened");
  await createLog(req.user.id, "create_ticket", `Created ticket #${row.id}`);
  const loaded = await loadTicket(row.id);
  if (row.assigned_to) {
    await createNotification({
      whatsapp: true,
      receiverId: row.assigned_to,
      type: "ticket_assigned",
      title: `New Ticket Assigned: ${title}`,
      message: `You have been assigned to ticket #${row.id}: ${String(description).slice(0, 100)}...`,
      link: `/tickets/${row.id}`,
      emailPayload: buildEmailPayload("ticket", loaded, {
        intro: `${req.user.names} has assigned you to a new support ticket.`,
        actor: req.user,
        actionRequired: "Please review the ticket details and respond or update the status as needed.",
      }),
    });
  } else {
    const recipients = await adminsAndHr(req.user.id);
    await notifyUsers(recipients.map((user) => user.id), {
      type: "new_ticket",
      title: `New Ticket Created: ${title}`,
      message: `A new ticket #${row.id} has been created and needs assignment`,
      link: `/tickets/${row.id}`,
      emailPayload: buildEmailPayload("ticket", loaded, {
        intro: `${req.user.names} has opened a new support ticket that requires assignment.`,
        actor: req.user,
        actionRequired: "Please review the ticket and assign it to the appropriate staff member.",
      }),
    });
  }
  await createNotification({
      whatsapp: true,
    receiverId: req.user.id,
    type: "ticket_created",
    title: `Ticket Created: ${title}`,
    message: `Your ticket #${row.id} has been created successfully`,
    link: `/tickets/${row.id}`,
    emailPayload: buildEmailPayload("ticket", loaded, {
      intro: "Your support ticket has been submitted successfully. You will be notified when there are updates.",
      actor: req.user,
    }),
  });
  return created(res, loaded, "Ticket created");
});

export const updateTicket = asyncHandler(async (req, res) => {
  const row = await db.Tickets.findByPk(req.params.id);
  if (!row) return fail(res, "Ticket not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  const patch = {};
  if (req.body.title) patch.title = req.body.title;
  if (req.body.description !== undefined) patch.description = req.body.description;
  if (req.body.priority && PRIORITIES.includes(req.body.priority)) patch.priority = req.body.priority;
  if (req.body.assigned_to !== undefined) patch.assigned_to = req.body.assigned_to;
  if (req.body.category) patch.category = req.body.category;
  if (req.body.status && STATUSES.includes(req.body.status)) {
    patch.status = req.body.status;
    if (["resolved", "closed"].includes(req.body.status)) patch.resolved_at = new Date();
  }
  await row.update(patch);
  if (patch.status) await addTicketLog(row.id, req.user.id, "status", `Status changed to ${patch.status}`);
  return ok(res, await loadTicket(row.id), "Ticket updated");
});

export const addTicketReply = asyncHandler(async (req, res) => {
  const ticket = await db.Tickets.findByPk(req.params.id);
  if (!ticket) return fail(res, "Ticket not found", 404);
  if (!canAccess(req.user, ticket)) return fail(res, "Access denied", 403);
  const message = String(req.body.message || req.body.reply_text || "").trim();
  if (!message) return fail(res, "message is required");
  const new_status = STATUSES.includes(req.body.new_status) ? req.body.new_status : null;
  let saved = null;
  try {
    saved = saveRequestFile(req, "tickets", { prefix: "reply", fieldNames: ["reply_attachment", "attachment", "file"] });
  } catch (error) {
    return fail(res, error.message);
  }
  const attachmentValue = saved ? `${saved.dbPath}|${saved.originalName}` : null;
  const reply = await db.TicketReplies.create({
    ticket_id: ticket.id,
    user_id: req.user.id,
    message,
    attachments: attachmentValue,
    is_status_update: new_status ? 1 : 0,
    new_status,
  });
  const oldStatus = ticket.status;
  const loadedTicket = () => loadTicket(ticket.id);
  if (new_status) {
    await ticket.update({
      status: new_status,
      resolved_at: ["resolved", "closed"].includes(new_status) ? new Date() : ticket.resolved_at,
    });
    await addTicketLog(ticket.id, req.user.id, "status_changed", `Status changed from ${oldStatus} to ${new_status}`);
    const involved = [
      ticket.created_by,
      ticket.assigned_to,
      ...(await db.TicketReplies.findAll({
        where: { ticket_id: ticket.id, user_id: { [Op.ne]: req.user.id } },
        attributes: ["user_id"],
        group: ["user_id"],
        raw: true,
      })).map((item) => item.user_id),
    ];
    const statusLoaded = await loadedTicket();
    await notifyUsers(involved, {
      type: "ticket_status",
      title: `Ticket Status Updated: ${ticket.title}`,
      message: `Ticket #${ticket.id} status changed from ${oldStatus} to ${new_status} by ${req.user.names}`,
      link: `/tickets/${ticket.id}`,
      emailPayload: buildEmailPayload("ticket", statusLoaded, {
        intro: `${req.user.names} updated ticket #${ticket.id} status from "${oldStatus}" to "${new_status}".`,
        actor: req.user,
        note: message,
      }),
    });
  }
  await ticket.update({ updated_at: new Date() });
  await addTicketLog(ticket.id, req.user.id, "replied", "Added reply");
  const replyRecipients = [
    ticket.created_by,
    ticket.assigned_to,
    ...(await db.TicketReplies.findAll({
      where: { ticket_id: ticket.id, user_id: { [Op.ne]: req.user.id } },
      attributes: ["user_id"],
      group: ["user_id"],
      raw: true,
    })).map((item) => item.user_id),
  ];
  const replyLoaded = await loadedTicket();
  await notifyUsers(replyRecipients.filter((id) => Number(id) !== Number(req.user.id)), {
    type: "ticket_reply",
    title: `New Reply on Ticket #${ticket.id}`,
    message,
    link: `/tickets/${ticket.id}`,
    emailPayload: buildEmailPayload("ticket", replyLoaded, {
      intro: `${req.user.names} posted a new reply on ticket #${ticket.id}.`,
      actor: req.user,
      replyPreview: message.slice(0, 200),
      note: message,
    }),
  });
  return created(res, decorateTicket(await loadTicket(ticket.id)), "Reply added");
});

export const assignTicket = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role) && !isExactHr(req.user.role)) return fail(res, "Access denied", 403);
  const ticket = await db.Tickets.findByPk(req.params.id);
  if (!ticket) return fail(res, "Ticket not found", 404);
  const assignedTo = Number(req.body.assigned_to);
  if (!assignedTo) return fail(res, "assigned_to is required");
  const oldAssignee = ticket.assigned_to;
  await ticket.update({ assigned_to: assignedTo });
  await addTicketLog(ticket.id, req.user.id, "assigned", `Assigned from user ID: ${oldAssignee || "none"} to user ID: ${assignedTo}`);
  const loaded = await loadTicket(ticket.id);
  await createNotification({
      whatsapp: true,
    receiverId: assignedTo,
    type: "ticket_assigned",
    title: `Ticket Assigned: ${ticket.title}`,
    message: `You have been assigned to ticket #${ticket.id} by ${req.user.names}`,
    link: `/tickets/${ticket.id}`,
    emailPayload: buildEmailPayload("ticket", loaded, {
      intro: `${req.user.names} has assigned you to ticket #${ticket.id}.`,
      actor: req.user,
      actionRequired: "Please review the ticket details and take appropriate action.",
    }),
  });
  if (ticket.created_by && Number(ticket.created_by) !== Number(req.user.id) && Number(ticket.created_by) !== assignedTo) {
    await createNotification({
      whatsapp: true,
      receiverId: ticket.created_by,
      type: "ticket_assigned",
      title: `Your Ticket Reassigned: ${ticket.title}`,
      message: `Ticket #${ticket.id} has been reassigned.`,
      link: `/tickets/${ticket.id}`,
      emailPayload: buildEmailPayload("ticket", loaded, {
        intro: `Your ticket #${ticket.id} has been reassigned to a new assignee by ${req.user.names}.`,
        actor: req.user,
      }),
    });
  }
  if (oldAssignee && Number(oldAssignee) !== assignedTo) {
    await createNotification({
      whatsapp: true,
      receiverId: oldAssignee,
      type: "ticket_unassigned",
      title: `Ticket Unassigned: ${ticket.title}`,
      message: `You have been unassigned from ticket #${ticket.id}`,
      link: `/tickets/${ticket.id}`,
      emailPayload: buildEmailPayload("ticket", loaded, {
        intro: `You have been unassigned from ticket #${ticket.id} by ${req.user.names}.`,
        actor: req.user,
      }),
    });
  }
  return ok(res, decorateTicket(loaded), "Ticket assigned successfully!");
});

export const deleteTicket = asyncHandler(async (req, res) => {
  const ticket = await db.Tickets.findByPk(req.params.id);
  if (!ticket) return fail(res, "Ticket not found", 404);
  const canDelete = isAdminRole(req.user.role)
    || isExactHr(req.user.role)
    || (
      Number(ticket.created_by) === Number(req.user.id)
      && (ticket.assigned_to == null || Number(ticket.assigned_to) === Number(req.user.id) || ["open", "resolved", "closed"].includes(ticket.status))
    );
  if (!canDelete) return fail(res, "You do not have permission to delete this ticket", 403);
  await db.TicketReplies.destroy({ where: { ticket_id: ticket.id } });
  await db.TicketLogs.destroy({ where: { ticket_id: ticket.id } });
  await ticket.destroy();
  return ok(res, null, "Ticket deleted");
});
