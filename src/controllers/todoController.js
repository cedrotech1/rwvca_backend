import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { isAdminRole } from "../utils/roleHelpers.js";

async function sharedTaskIds(userId) {
  const shares = await db.TodoShares.findAll({
    where: { shared_with: userId, status: { [Op.ne]: "declined" } },
    attributes: ["task_id"],
  });
  return shares.map((row) => row.task_id);
}

async function canAccess(user, row) {
  if (isAdminRole(user.role) || Number(row.user_id) === Number(user.id)) return true;
  const share = await db.TodoShares.findOne({
    where: { task_id: row.id, shared_with: user.id, status: { [Op.ne]: "declined" } },
  });
  return Boolean(share);
}

async function addActivity(taskId, userId, action, details) {
  await db.TodoActivityLog.create({ task_id: taskId, user_id: userId, action, details: details || null });
}

async function loadTodo(id) {
  return db.UserTasks.findByPk(id, {
    include: [
      { model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] },
      { model: db.Users, as: "sharedByUser", attributes: ["id", "names", "email"] },
      {
        model: db.TodoComments,
        as: "comments",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email"] }],
      },
      { model: db.TodoShares, as: "shares" },
      {
        model: db.TodoActivityLog,
        as: "activityLogs",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email"] }],
      },
    ],
  });
}

export const getTodos = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const tab = req.query.tab || "mine";
  const where = {};
  if (tab === "shared") {
    where.id = await sharedTaskIds(req.user.id);
  } else if (tab === "all") {
    const ids = await sharedTaskIds(req.user.id);
    where[Op.or] = [{ user_id: req.user.id }, { id: ids.length ? ids : [-1] }];
  } else {
    where.user_id = req.user.id;
  }
  if (req.query.is_completed !== undefined) where.is_completed = Number(req.query.is_completed);
  if (req.query.priority) where.priority = req.query.priority;
  if (req.query.search) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      { [Op.or]: [{ title: { [Op.iLike]: `%${req.query.search}%` } }, { description: { [Op.iLike]: `%${req.query.search}%` } }] },
    ];
  }

  const { rows, count } = await db.UserTasks.findAndCountAll({
    where,
    include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email"] }],
    order: [["due_date", "ASC"], ["id", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getTodo = asyncHandler(async (req, res) => {
  const row = await loadTodo(req.params.id);
  if (!row) return fail(res, "Todo not found", 404);
  if (!(await canAccess(req.user, row))) return fail(res, "Access denied", 403);
  return ok(res, row);
});

export const createTodo = asyncHandler(async (req, res) => {
  if (!req.body.title || !req.body.due_date) return fail(res, "title and due_date are required");
  const row = await db.UserTasks.create({
    user_id: req.user.id,
    title: req.body.title,
    due_date: req.body.due_date,
    description: req.body.description || null,
    priority: req.body.priority || "Medium",
    location: req.body.location || null,
    from_datetime: req.body.from_datetime || null,
    to_datetime: req.body.to_datetime || null,
    is_completed: 0,
  });
  await addActivity(row.id, req.user.id, "created", "Todo created");
  await createLog(req.user.id, "create_todo", `Created todo #${row.id}`);
  return created(res, await loadTodo(row.id), "Todo created");
});

export const updateTodo = asyncHandler(async (req, res) => {
  const row = await db.UserTasks.findByPk(req.params.id);
  if (!row) return fail(res, "Todo not found", 404);
  if (!(await canAccess(req.user, row))) return fail(res, "Access denied", 403);
  const body = { ...req.body };
  delete body.user_id;
  await row.update(body);
  await addActivity(row.id, req.user.id, "updated", "Todo updated");
  return ok(res, await loadTodo(row.id), "Todo updated");
});

export const completeTodo = asyncHandler(async (req, res) => {
  const row = await db.UserTasks.findByPk(req.params.id);
  if (!row) return fail(res, "Todo not found", 404);
  if (!(await canAccess(req.user, row))) return fail(res, "Access denied", 403);
  const is_completed = req.body.is_completed === 0 ? 0 : 1;
  await row.update({ is_completed });
  await addActivity(row.id, req.user.id, is_completed ? "completed" : "reopened", null);
  return ok(res, await loadTodo(row.id), is_completed ? "Todo completed" : "Todo reopened");
});

export const shareTodo = asyncHandler(async (req, res) => {
  const row = await db.UserTasks.findByPk(req.params.id);
  if (!row) return fail(res, "Todo not found", 404);
  if (Number(row.user_id) !== Number(req.user.id) && !isAdminRole(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  const ids = Array.isArray(req.body.user_ids) ? req.body.user_ids : [];
  if (!ids.length) return fail(res, "user_ids is required");
  for (const shared_with of ids) {
    const [share] = await db.TodoShares.findOrCreate({
      where: { task_id: row.id, shared_with },
      defaults: {
        shared_by: req.user.id,
        permission: req.body.permission || "view",
        status: "pending",
      },
    });
    await row.update({ is_shared: 1, shared_by: req.user.id });
    const loaded = await loadTodo(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: shared_with,
      type: "todo_share",
      title: "A todo was shared with you",
      message: `${req.user.names} shared '${row.title}' with you.`,
      link: `/todos/${row.id}`,
      emailPayload: buildEmailPayload("todo", loaded, {
        intro: `${req.user.names} has shared a task with you on the RWVCA portal.`,
        actor: req.user,
        actionRequired: "Please review the shared task and update its status or add comments as needed.",
      }),
    });
    void share;
  }
  await addActivity(row.id, req.user.id, "shared", `Shared with ${ids.length} user(s)`);
  return ok(res, await loadTodo(row.id), "Todo shared");
});

export const addTodoComment = asyncHandler(async (req, res) => {
  const row = await db.UserTasks.findByPk(req.params.id);
  if (!row) return fail(res, "Todo not found", 404);
  if (!(await canAccess(req.user, row))) return fail(res, "Access denied", 403);
  const comment = String(req.body.comment || "").trim();
  if (!comment) return fail(res, "comment is required");
  const createdRow = await db.TodoComments.create({
    task_id: row.id,
    user_id: req.user.id,
    comment,
  });
  await addActivity(row.id, req.user.id, "commented", comment.slice(0, 120));
  return created(res, createdRow, "Comment added");
});

export const deleteTodo = asyncHandler(async (req, res) => {
  const row = await db.UserTasks.findByPk(req.params.id);
  if (!row) return fail(res, "Todo not found", 404);
  if (Number(row.user_id) !== Number(req.user.id) && !isAdminRole(req.user.role)) {
    return fail(res, "Access denied", 403);
  }
  await db.TodoComments.destroy({ where: { task_id: row.id } });
  await db.TodoShares.destroy({ where: { task_id: row.id } });
  await db.TodoActivityLog.destroy({ where: { task_id: row.id } });
  await row.destroy();
  return ok(res, null, "Todo deleted");
});
