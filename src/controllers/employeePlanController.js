import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { USER_PUBLIC } from "../services/workflowUsers.js";
import { userHasPrivilege } from "../services/privilegeService.js";
import { isAdminRole, isExecutiveRole } from "../utils/roleHelpers.js";
import { toPlainText } from "../utils/plainText.js";

const USER_ATTR = { attributes: USER_PUBLIC };
const PLAN_STATUSES = ["draft", "pending", "ongoing", "complete", "postponed"];
const REPORT_TYPES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];

function canMonitorPlans(user) {
  return (
    userHasPrivilege(user, "plans.monitor") ||
    (Array.isArray(user?.privilege_codes) && user.privilege_codes.includes("plans.monitor")) ||
    isAdminRole(user) ||
    isExecutiveRole(user)
  );
}

async function isCollaborator(planId, userId) {
  return db.EmployeePlanCollaborators.findOne({
    where: { plan_id: planId, user_id: userId },
  });
}

async function canAccessPlan(user, plan) {
  if (!plan) return false;
  if (Number(plan.user_id) === Number(user.id)) return true;
  if (canMonitorPlans(user)) return true;
  const collab = await isCollaborator(plan.id, user.id);
  return Boolean(collab && collab.response_status !== "declined");
}

async function addPlanLog({ planId = null, reportId = null, action, detail, userId, meta = null }) {
  if (!db.EmployeePlanLogs) return;
  try {
    await db.EmployeePlanLogs.create({
      plan_id: planId,
      report_id: reportId,
      action,
      detail: detail ? toPlainText(String(detail)).slice(0, 2000) : null,
      changed_by: userId || null,
      meta: meta ? JSON.stringify(meta) : null,
    });
  } catch (err) {
    console.warn("employee plan log failed:", err.message);
  }
}

async function notifyMonitors({ title, message, link, excludeId = null }) {
  const monitors = await db.Users.findAll({
    where: { deleted: { [Op.ne]: "1" }, active: 1 },
    attributes: ["id", "role", "names", "email"],
  });
  const eligible = [];
  for (const user of monitors) {
    if (excludeId && Number(user.id) === Number(excludeId)) continue;
    // privilege_codes may not be on row — load via helper when possible
    if (canMonitorPlans(user) || isAdminRole(user) || isExecutiveRole(user)) {
      eligible.push(user);
    }
  }
  // Also privilege holders via role_privileges
  try {
    const [privRows] = await db.sequelize.query(
      `SELECT DISTINCT u.id, u.names, u.email, u.role
       FROM users u
       JOIN roles r ON LOWER(r.role_name) = LOWER(u.role)
       JOIN role_privileges rp ON rp.role_id = r.id
       JOIN privileges p ON p.id = rp.privilege_id
       WHERE p.code IN ('plans.monitor', 'menu.staff_monitoring')
         AND COALESCE(u.deleted, '0') <> '1'
         AND COALESCE(u.active, 1) = 1`
    );
    const seen = new Set(eligible.map((u) => Number(u.id)));
    for (const row of privRows || []) {
      if (excludeId && Number(row.id) === Number(excludeId)) continue;
      if (!seen.has(Number(row.id))) {
        seen.add(Number(row.id));
        eligible.push(row);
      }
    }
  } catch {
    // ignore if join fails
  }

  await Promise.all(
    eligible.map((user) =>
      createNotification({
        whatsapp: false,
        receiverId: user.id,
        type: "employee_plan",
        title,
        message,
        link,
        priority: "low",
      })
    )
  );
}

async function loadPlan(id) {
  return db.EmployeePlans.findByPk(id, {
    include: [
      { model: db.Users, as: "owner", ...USER_ATTR },
      {
        model: db.EmployeePlanCollaborators,
        as: "collaborators",
        include: [{ model: db.Users, as: "user", ...USER_ATTR }],
      },
      {
        model: db.EmployeePlanComments,
        as: "comments",
        include: [{ model: db.Users, as: "author", attributes: ["id", "names", "email", "role"] }],
      },
      {
        model: db.EmployeePlanLogs,
        as: "logs",
        include: [{ model: db.Users, as: "actor", attributes: ["id", "names", "email", "role"] }],
        separate: true,
        order: [["id", "DESC"]],
        limit: 80,
      },
    ],
    order: [
      [{ model: db.EmployeePlanCollaborators, as: "collaborators" }, "id", "ASC"],
      [{ model: db.EmployeePlanComments, as: "comments" }, "id", "ASC"],
    ],
  });
}

function parseSharedDepartmentIds(value) {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    const ids = value.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    return ids.length ? JSON.stringify(ids) : null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const ids = parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0);
        return ids.length ? JSON.stringify(ids) : null;
      }
    } catch {
      const ids = value
        .split(",")
        .map((v) => Number(String(v).trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      return ids.length ? JSON.stringify(ids) : null;
    }
  }
  return null;
}

function sharedDeptList(report) {
  try {
    const parsed = JSON.parse(report.shared_department_ids || "[]");
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

export const listPlans = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const tab = String(req.query.tab || "mine").toLowerCase();
  const where = {};

  if (tab === "collaborations") {
    const collabs = await db.EmployeePlanCollaborators.findAll({
      where: { user_id: req.user.id, response_status: { [Op.ne]: "declined" } },
      attributes: ["plan_id"],
    });
    where.id = collabs.length ? collabs.map((c) => c.plan_id) : [-1];
  } else if (tab === "all" && canMonitorPlans(req.user)) {
    if (req.query.user_id) where.user_id = Number(req.query.user_id);
  } else {
    where.user_id = req.user.id;
  }

  if (req.query.status) where.status = req.query.status;
  if (req.query.is_joint === "1" || req.query.is_joint === "true") where.is_joint = 1;
  if (req.query.is_joint === "0" || req.query.is_joint === "false") where.is_joint = 0;

  if (req.query.search) {
    const search = String(req.query.search).trim();
    const like = { [Op.iLike]: `%${search}%` };
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [{ title: like }, { description: like }],
      },
    ];
  }

  const sort = String(req.query.sort || "start_date").toLowerCase();
  const dir = String(req.query.dir || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
  const orderMap = {
    start_date: [["start_date", dir], ["id", "DESC"]],
    end_date: [["end_date", dir], ["id", "DESC"]],
    status: [["status", dir], ["id", "DESC"]],
    title: [["title", dir], ["id", "DESC"]],
    created_at: [["created_at", dir], ["id", "DESC"]],
  };
  const order = orderMap[sort] || orderMap.start_date;

  const { rows, count } = await db.EmployeePlans.findAndCountAll({
    where,
    include: [
      { model: db.Users, as: "owner", attributes: ["id", "names", "email", "role", "department_ID"] },
      {
        model: db.EmployeePlanCollaborators,
        as: "collaborators",
        include: [{ model: db.Users, as: "user", attributes: ["id", "names", "email", "role"] }],
      },
    ],
    order,
    limit,
    offset,
    distinct: true,
    subQuery: false,
  });

  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getPlan = asyncHandler(async (req, res) => {
  const row = await loadPlan(req.params.id);
  if (!row) return fail(res, "Plan not found", 404);
  if (!(await canAccessPlan(req.user, row))) return fail(res, "Access denied", 403);
  return ok(res, row);
});

export const listPlanLogs = asyncHandler(async (req, res) => {
  const plan = await db.EmployeePlans.findByPk(req.params.id);
  if (!plan) return fail(res, "Plan not found", 404);
  if (!(await canAccessPlan(req.user, plan))) return fail(res, "Access denied", 403);

  const rows = await db.EmployeePlanLogs.findAll({
    where: { plan_id: plan.id },
    include: [{ model: db.Users, as: "actor", attributes: ["id", "names", "email", "role"] }],
    order: [["id", "DESC"]],
    limit: 200,
  });
  return ok(res, rows);
});

export const createPlan = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const start_date = body.start_date;
  const end_date = body.end_date;
  if (!title || !start_date || !end_date) {
    return fail(res, "title, start_date, and end_date are required");
  }

  const status = PLAN_STATUSES.includes(body.status) ? body.status : "draft";
  const description = body.description != null ? String(body.description) : null;
  const row = await db.EmployeePlans.create({
    user_id: req.user.id,
    title,
    description,
    start_date,
    end_date,
    status,
    is_joint: body.is_joint ? 1 : 0,
  });

  const collaboratorIds = Array.isArray(body.collaborator_ids)
    ? [...new Set(body.collaborator_ids.map(Number).filter((n) => n && n !== Number(req.user.id)))]
    : [];
  if (collaboratorIds.length) {
    await db.EmployeePlanCollaborators.bulkCreate(
      collaboratorIds.map((user_id) => ({
        plan_id: row.id,
        user_id,
        response_status: "pending",
      }))
    );
    await row.update({ is_joint: 1 });
    await Promise.all(
      collaboratorIds.map((user_id) =>
        createNotification({
          whatsapp: true,
          receiverId: user_id,
          type: "employee_plan",
          title: "Plan collaboration invite",
          message: `${req.user.names} invited you to collaborate on "${title}". Please accept or decline.`,
          link: `/employee-plans/${row.id}`,
          priority: "high",
        })
      )
    );
  }

  await addPlanLog({
    planId: row.id,
    action: "created",
    detail: `Created plan "${title}" (${status})${collaboratorIds.length ? ` with ${collaboratorIds.length} collaborator(s)` : ""}`,
    userId: req.user.id,
    meta: { status, collaborator_ids: collaboratorIds },
  });
  await createLog(req.user.id, "create_employee_plan", `Created employee plan #${row.id}`);
  await notifyMonitors({
    title: "New employee plan",
    message: `${req.user.names} created plan "${title}".`,
    link: `/employee-plans/${row.id}`,
    excludeId: req.user.id,
  });

  return created(res, await loadPlan(row.id), "Plan created");
});

export const updatePlan = asyncHandler(async (req, res) => {
  const row = await db.EmployeePlans.findByPk(req.params.id);
  if (!row) return fail(res, "Plan not found", 404);
  if (Number(row.user_id) !== Number(req.user.id) && !canMonitorPlans(req.user)) {
    return fail(res, "Access denied", 403);
  }

  const body = req.body || {};
  const patch = {};
  if (body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (!title) return fail(res, "title is required");
    patch.title = title;
  }
  if (body.description !== undefined) {
    patch.description = body.description != null ? String(body.description) : null;
  }
  if (body.start_date !== undefined) patch.start_date = body.start_date;
  if (body.end_date !== undefined) patch.end_date = body.end_date;
  if (body.is_joint !== undefined) patch.is_joint = body.is_joint ? 1 : 0;

  await row.update(patch);
  await addPlanLog({
    planId: row.id,
    action: "updated",
    detail: `Updated plan fields: ${Object.keys(patch).join(", ") || "none"}`,
    userId: req.user.id,
    meta: patch,
  });
  await createLog(req.user.id, "update_employee_plan", `Updated employee plan #${row.id}`);

  const collabs = await db.EmployeePlanCollaborators.findAll({
    where: { plan_id: row.id, response_status: { [Op.ne]: "declined" } },
  });
  await Promise.all(
    collabs
      .filter((c) => Number(c.user_id) !== Number(req.user.id))
      .map((c) =>
        createNotification({
          whatsapp: false,
          receiverId: c.user_id,
          type: "employee_plan",
          title: "Plan updated",
          message: `${req.user.names} updated "${row.title}".`,
          link: `/employee-plans/${row.id}`,
          priority: "middle",
        })
      )
  );

  return ok(res, await loadPlan(row.id), "Plan updated");
});

export const deletePlan = asyncHandler(async (req, res) => {
  const row = await db.EmployeePlans.findByPk(req.params.id);
  if (!row) return fail(res, "Plan not found", 404);
  if (Number(row.user_id) !== Number(req.user.id) && !canMonitorPlans(req.user) && !isAdminRole(req.user)) {
    return fail(res, "Access denied", 403);
  }

  const title = row.title;
  const ownerId = row.user_id;
  const collabs = await db.EmployeePlanCollaborators.findAll({ where: { plan_id: row.id } });

  await addPlanLog({
    planId: null,
    action: "deleted",
    detail: `Deleted plan #${row.id} "${title}"`,
    userId: req.user.id,
    meta: { plan_id: row.id, title },
  });

  await db.EmployeePlanComments.destroy({ where: { plan_id: row.id } });
  await db.EmployeePlanCollaborators.destroy({ where: { plan_id: row.id } });
  await db.EmployeePlanLogs.destroy({ where: { plan_id: row.id } }).catch(() => {});
  await row.destroy();

  await createLog(req.user.id, "delete_employee_plan", `Deleted employee plan #${req.params.id}`);

  const notifyIds = new Set([Number(ownerId), ...collabs.map((c) => Number(c.user_id))]);
  notifyIds.delete(Number(req.user.id));
  await Promise.all(
    [...notifyIds].map((receiverId) =>
      createNotification({
        whatsapp: false,
        receiverId,
        type: "employee_plan",
        title: "Plan deleted",
        message: `${req.user.names} deleted plan "${title}".`,
        link: `/employee-plans`,
        priority: "middle",
      })
    )
  );

  return ok(res, null, "Plan deleted");
});

export const updatePlanStatus = asyncHandler(async (req, res) => {
  const row = await db.EmployeePlans.findByPk(req.params.id);
  if (!row) return fail(res, "Plan not found", 404);
  if (Number(row.user_id) !== Number(req.user.id) && !canMonitorPlans(req.user)) {
    return fail(res, "Access denied", 403);
  }

  const status = String(req.body.status || "").trim().toLowerCase();
  if (!PLAN_STATUSES.includes(status)) {
    return fail(res, `status must be one of: ${PLAN_STATUSES.join(", ")}`);
  }

  const previous = row.status;
  await row.update({ status });
  await addPlanLog({
    planId: row.id,
    action: "status_changed",
    detail: `Status ${previous} → ${status}`,
    userId: req.user.id,
    meta: { from: previous, to: status },
  });
  await createLog(req.user.id, "update_employee_plan_status", `Plan #${row.id} → ${status}`);

  const collabs = await db.EmployeePlanCollaborators.findAll({
    where: { plan_id: row.id, response_status: { [Op.ne]: "declined" } },
  });
  const notifyIds = new Set([Number(row.user_id), ...collabs.map((c) => Number(c.user_id))]);
  notifyIds.delete(Number(req.user.id));
  await Promise.all(
    [...notifyIds].map((receiverId) =>
      createNotification({
        whatsapp: true,
        receiverId,
        type: "employee_plan",
        title: `Plan status: ${status}`,
        message: `Plan "${row.title}" is now ${status}.`,
        link: `/employee-plans/${row.id}`,
        priority: "middle",
      })
    )
  );
  await notifyMonitors({
    title: `Plan ${status}`,
    message: `${req.user.names} marked "${row.title}" as ${status}.`,
    link: `/employee-plans/${row.id}`,
    excludeId: req.user.id,
  });

  return ok(res, await loadPlan(row.id), "Plan status updated");
});

export const setCollaborators = asyncHandler(async (req, res) => {
  const row = await db.EmployeePlans.findByPk(req.params.id);
  if (!row) return fail(res, "Plan not found", 404);
  if (Number(row.user_id) !== Number(req.user.id)) return fail(res, "Access denied", 403);

  const ids = Array.isArray(req.body.user_ids)
    ? [...new Set(req.body.user_ids.map(Number).filter((n) => n && n !== Number(req.user.id)))]
    : [];

  const existing = await db.EmployeePlanCollaborators.findAll({ where: { plan_id: row.id } });
  const existingIds = new Set(existing.map((e) => Number(e.user_id)));
  const nextIds = new Set(ids);

  const toRemove = existing.filter((e) => !nextIds.has(Number(e.user_id)));
  const toAdd = ids.filter((id) => !existingIds.has(id));

  if (toRemove.length) {
    await db.EmployeePlanCollaborators.destroy({
      where: { plan_id: row.id, user_id: toRemove.map((e) => e.user_id) },
    });
  }
  if (toAdd.length) {
    await db.EmployeePlanCollaborators.bulkCreate(
      toAdd.map((user_id) => ({
        plan_id: row.id,
        user_id,
        response_status: "pending",
      }))
    );
    await Promise.all(
      toAdd.map((user_id) =>
        createNotification({
          whatsapp: true,
          receiverId: user_id,
          type: "employee_plan",
          title: "Plan collaboration invite",
          message: `${req.user.names} invited you to collaborate on "${row.title}". Please accept or decline.`,
          link: `/employee-plans/${row.id}`,
          priority: "high",
        })
      )
    );
  }

  await row.update({ is_joint: ids.length ? 1 : 0 });
  await addPlanLog({
    planId: row.id,
    action: "collaborators_updated",
    detail: `Collaborators set (${ids.length}). Added ${toAdd.length}, removed ${toRemove.length}.`,
    userId: req.user.id,
    meta: { user_ids: ids, added: toAdd, removed: toRemove.map((e) => e.user_id) },
  });
  await createLog(req.user.id, "set_plan_collaborators", `Updated collaborators on plan #${row.id}`);
  return ok(res, await loadPlan(row.id), "Collaborators updated");
});

export const respondCollaborator = asyncHandler(async (req, res) => {
  const response = String(req.body.response || req.body.status || "")
    .trim()
    .toLowerCase();
  if (!["accepted", "accept", "declined", "decline"].includes(response)) {
    return fail(res, "response must be accept or decline");
  }
  const status = response.startsWith("accept") ? "accepted" : "declined";
  const reply_note = req.body.reply_note != null ? String(req.body.reply_note) : null;

  const collab = await db.EmployeePlanCollaborators.findOne({
    where: { plan_id: req.params.id, user_id: req.user.id },
  });
  if (!collab) return fail(res, "Collaboration invite not found", 404);

  await collab.update({
    response_status: status,
    reply_note: reply_note ? toPlainText(reply_note).slice(0, 2000) : null,
  });
  const plan = await db.EmployeePlans.findByPk(req.params.id);
  if (plan) {
    await createNotification({
      whatsapp: true,
      receiverId: plan.user_id,
      type: "employee_plan",
      title: `Collaboration ${status}`,
      message: `${req.user.names} ${status} collaboration on "${plan.title}".${
        reply_note ? ` Note: ${toPlainText(reply_note)}` : ""
      }`,
      link: `/employee-plans/${plan.id}`,
      priority: "high",
    });
  }
  await addPlanLog({
    planId: Number(req.params.id),
    action: `collaborator_${status}`,
    detail: `${req.user.names} ${status}${reply_note ? `: ${toPlainText(reply_note)}` : ""}`,
    userId: req.user.id,
  });
  await createLog(req.user.id, "respond_plan_collaborator", `Plan #${req.params.id} collaborator ${status}`);
  return ok(res, await loadPlan(req.params.id), `Collaboration ${status}`);
});

export const listComments = asyncHandler(async (req, res) => {
  const plan = await db.EmployeePlans.findByPk(req.params.id);
  if (!plan) return fail(res, "Plan not found", 404);
  if (!(await canAccessPlan(req.user, plan))) return fail(res, "Access denied", 403);

  const rows = await db.EmployeePlanComments.findAll({
    where: { plan_id: plan.id },
    include: [{ model: db.Users, as: "author", attributes: ["id", "names", "email", "role"] }],
    order: [["id", "ASC"]],
  });
  return ok(res, rows);
});

export const addComment = asyncHandler(async (req, res) => {
  const plan = await db.EmployeePlans.findByPk(req.params.id);
  if (!plan) return fail(res, "Plan not found", 404);
  if (!(await canAccessPlan(req.user, plan))) return fail(res, "Access denied", 403);

  const comment = String(req.body.comment || "").trim();
  if (!comment) return fail(res, "comment is required");

  const row = await db.EmployeePlanComments.create({
    plan_id: plan.id,
    user_id: req.user.id,
    comment,
  });

  const notifyIds = new Set([Number(plan.user_id)]);
  const collabs = await db.EmployeePlanCollaborators.findAll({
    where: { plan_id: plan.id, response_status: { [Op.ne]: "declined" } },
  });
  collabs.forEach((c) => notifyIds.add(Number(c.user_id)));
  notifyIds.delete(Number(req.user.id));

  await Promise.all(
    [...notifyIds].map((receiverId) =>
      createNotification({
        whatsapp: true,
        receiverId,
        type: "employee_plan",
        title: "New plan comment",
        message: `${req.user.names} commented on "${plan.title}": ${toPlainText(comment).slice(0, 160)}`,
        link: `/employee-plans/${plan.id}`,
        priority: "middle",
      })
    )
  );

  await addPlanLog({
    planId: plan.id,
    action: "comment_added",
    detail: toPlainText(comment).slice(0, 500),
    userId: req.user.id,
  });
  await createLog(req.user.id, "add_plan_comment", `Commented on plan #${plan.id}`);
  const loaded = await db.EmployeePlanComments.findByPk(row.id, {
    include: [{ model: db.Users, as: "author", attributes: ["id", "names", "email", "role"] }],
  });
  return created(res, loaded, "Comment added");
});

export const createReport = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const report_type = String(body.report_type || "")
    .trim()
    .toUpperCase();
  if (!REPORT_TYPES.includes(report_type)) {
    return fail(res, `report_type must be one of: ${REPORT_TYPES.join(", ")}`);
  }
  const title = String(body.title || "").trim();
  const period_start = body.period_start;
  const period_end = body.period_end;
  if (!title || !period_start || !period_end) {
    return fail(res, "title, period_start, and period_end are required");
  }

  const shared_department_ids = parseSharedDepartmentIds(
    body.shared_department_ids ?? body.sharedDepartmentIds
  );
  const deptIds = shared_department_ids ? JSON.parse(shared_department_ids) : [];

  const row = await db.EmployeePlanReports.create({
    user_id: req.user.id,
    report_type,
    title,
    period_start,
    period_end,
    content: body.content != null ? String(body.content) : null,
    shared_department_ids,
  });

  await addPlanLog({
    planId: null,
    reportId: row.id,
    action: "report_created",
    detail: `Created ${report_type} report "${title}" shared to ${deptIds.length} department(s)`,
    userId: req.user.id,
    meta: { report_id: row.id, shared_department_ids: deptIds },
  });
  await createLog(req.user.id, "create_employee_plan_report", `Created plan report #${row.id}`);

  if (deptIds.length) {
    const deptUsers = await db.Users.findAll({
      where: {
        deleted: { [Op.ne]: "1" },
        active: 1,
        department_ID: { [Op.in]: deptIds },
      },
      attributes: ["id", "names", "email", "department_ID"],
    });
    await Promise.all(
      deptUsers
        .filter((u) => Number(u.id) !== Number(req.user.id))
        .map((u) =>
          createNotification({
            whatsapp: true,
            receiverId: u.id,
            type: "employee_plan",
            title: `${report_type} plan report shared`,
            message: `${req.user.names} shared "${title}" (${period_start} → ${period_end}) with your department.`,
            link: `/employee-plans`,
            priority: "middle",
          })
        )
    );
  }

  await notifyMonitors({
    title: "Plan report shared",
    message: `${req.user.names} created ${report_type} report "${title}".`,
    link: `/employee-plans`,
    excludeId: req.user.id,
  });

  return created(res, row, "Report created");
});

export const listReports = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const scope = String(req.query.scope || "mine").toLowerCase();

  if (scope === "department" || scope === "shared") {
    const deptId = Number(req.query.department_id || req.user.department_ID);
    if (!deptId) return fail(res, "department_id is required");

    const all = await db.EmployeePlanReports.findAll({
      include: [{ model: db.Users, as: "author", attributes: ["id", "names", "email", "role", "department_ID"] }],
      order: [["created_at", "DESC"]],
    });
    const filtered = all.filter((r) => sharedDeptList(r).includes(deptId));
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    return ok(res, { items, pagination: paginationMeta(total, page, limit) });
  }

  if (scope === "all" && canMonitorPlans(req.user)) {
    const { rows, count } = await db.EmployeePlanReports.findAndCountAll({
      include: [{ model: db.Users, as: "author", attributes: ["id", "names", "email", "role"] }],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });
    return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
  }

  const { rows, count } = await db.EmployeePlanReports.findAndCountAll({
    where: { user_id: req.user.id },
    include: [{ model: db.Users, as: "author", attributes: ["id", "names", "email", "role"] }],
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getStaffMonitoring = asyncHandler(async (req, res) => {
  if (!canMonitorPlans(req.user)) return fail(res, "Access denied", 403);

  const now = new Date();
  const periodStart = req.query.period_start
    ? String(req.query.period_start)
    : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const periodEnd = req.query.period_end
    ? String(req.query.period_end)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const search = String(req.query.search || "").trim().toLowerCase();
  const sort = String(req.query.sort || "completed").toLowerCase();
  const departmentId = req.query.department_id ? Number(req.query.department_id) : null;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const staffWhere = {
    deleted: { [Op.ne]: "1" },
    active: 1,
  };
  if (departmentId) staffWhere.department_ID = departmentId;

  const staff = await db.Users.findAll({
    where: staffWhere,
    attributes: ["id", "names", "email", "role", "department_ID", "last_login_at"],
    include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
    order: [["names", "ASC"]],
  });

  const plans = await db.EmployeePlans.findAll({
    where: {
      [Op.or]: [
        { start_date: { [Op.between]: [periodStart, periodEnd] } },
        { end_date: { [Op.between]: [periodStart, periodEnd] } },
        {
          [Op.and]: [
            { start_date: { [Op.lte]: periodStart } },
            { end_date: { [Op.gte]: periodEnd } },
          ],
        },
      ],
    },
    include: [
      {
        model: db.EmployeePlanCollaborators,
        as: "collaborators",
        attributes: ["id", "user_id", "response_status"],
      },
    ],
  });

  const reportsThisMonth = await db.EmployeePlanReports.findAll({
    where: { created_at: { [Op.between]: [monthStart, monthEnd] } },
    attributes: ["id", "user_id", "shared_department_ids", "created_at", "report_type", "title"],
  });

  const recentLogs = db.EmployeePlanLogs
    ? await db.EmployeePlanLogs.findAll({
        include: [
          { model: db.Users, as: "actor", attributes: ["id", "names", "role"] },
          { model: db.EmployeePlans, as: "plan", attributes: ["id", "title"] },
        ],
        order: [["id", "DESC"]],
        limit: 40,
      })
    : [];

  const plansByUser = new Map();
  let jointPlans = 0;
  let acceptedInvites = 0;
  let pendingInvites = 0;
  let declinedInvites = 0;

  for (const plan of plans) {
    const uid = Number(plan.user_id);
    if (!plansByUser.has(uid)) plansByUser.set(uid, []);
    plansByUser.get(uid).push(plan);
    if (plan.is_joint) jointPlans += 1;
    for (const c of plan.collaborators || []) {
      if (c.response_status === "accepted") acceptedInvites += 1;
      else if (c.response_status === "pending") pendingInvites += 1;
      else if (c.response_status === "declined") declinedInvites += 1;
    }
  }

  const reportsByUser = new Map();
  for (const report of reportsThisMonth) {
    const uid = Number(report.user_id);
    if (!reportsByUser.has(uid)) reportsByUser.set(uid, []);
    reportsByUser.get(uid).push(report);
  }

  const statusCounts = { draft: 0, pending: 0, ongoing: 0, complete: 0, postponed: 0 };
  for (const plan of plans) {
    if (statusCounts[plan.status] !== undefined) statusCounts[plan.status] += 1;
  }

  const deptPlanMap = new Map();

  let staffRows = staff.map((user) => {
    const uid = Number(user.id);
    const userPlans = plansByUser.get(uid) || [];
    const userReports = reportsByUser.get(uid) || [];
    const completed = userPlans.filter((p) => p.status === "complete").length;
    const joint = userPlans.filter((p) => p.is_joint).length;
    const sharedReports = userReports.filter((r) => sharedDeptList(r).length > 0);
    const completionRate = userPlans.length
      ? Math.round((completed / userPlans.length) * 100)
      : 0;
    const collaborationRate = userPlans.length
      ? Math.round((joint / userPlans.length) * 100)
      : 0;
    const deptName = user.department?.name || "Unassigned";
    if (!deptPlanMap.has(deptName)) deptPlanMap.set(deptName, { department: deptName, plans: 0, completed: 0, staff: 0 });
    const d = deptPlanMap.get(deptName);
    d.staff += 1;
    d.plans += userPlans.length;
    d.completed += completed;

    const lastLogin = user.last_login_at ? new Date(user.last_login_at) : null;
    return {
      id: user.id,
      names: user.names,
      email: user.email,
      role: user.role,
      department: user.department,
      last_login_at: user.last_login_at || null,
      login_bucket: !lastLogin
        ? "never"
        : lastLogin >= d7
          ? "7d"
          : lastLogin >= d30
            ? "30d"
            : "older",
      has_plan_this_period: userPlans.length > 0,
      plan_count: userPlans.length,
      completed_plans: completed,
      joint_plans: joint,
      completion_rate: completionRate,
      collaboration_rate: collaborationRate,
      status_breakdown: PLAN_STATUSES.reduce((acc, s) => {
        acc[s] = userPlans.filter((p) => p.status === s).length;
        return acc;
      }, {}),
      reports_this_month: userReports.length,
      shared_reports_this_month: sharedReports.length,
      did_not_share_report_this_month: sharedReports.length === 0,
      plans_preview: userPlans.slice(0, 8).map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        is_joint: p.is_joint,
        start_date: p.start_date,
        end_date: p.end_date,
      })),
    };
  });

  if (search) {
    staffRows = staffRows.filter(
      (s) =>
        String(s.names || "").toLowerCase().includes(search) ||
        String(s.email || "").toLowerCase().includes(search) ||
        String(s.role || "").toLowerCase().includes(search) ||
        String(s.department?.name || "").toLowerCase().includes(search)
    );
  }

  const sortFns = {
    completed: (a, b) => b.completed_plans - a.completed_plans || a.names.localeCompare(b.names),
    plans: (a, b) => b.plan_count - a.plan_count || a.names.localeCompare(b.names),
    completion_rate: (a, b) => b.completion_rate - a.completion_rate || a.names.localeCompare(b.names),
    collaboration_rate: (a, b) => b.collaboration_rate - a.collaboration_rate || a.names.localeCompare(b.names),
    name: (a, b) => a.names.localeCompare(b.names),
    last_login: (a, b) => {
      const ta = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
      const tb = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
      return tb - ta;
    },
  };
  const sorter = sortFns[sort] || sortFns.completed;
  const ranking = [...staffRows].sort(sorter).map((s, index) => ({ rank: index + 1, ...s }));

  const withPlans = staffRows.filter((s) => s.has_plan_this_period);
  const withoutPlans = staffRows.filter((s) => !s.has_plan_this_period);
  const noSharedReports = staffRows.filter((s) => s.did_not_share_report_this_month);
  const jointRate = plans.length ? Math.round((jointPlans / plans.length) * 100) : 0;

  return ok(res, {
    period: { start: periodStart, end: periodEnd },
    status_counts: statusCounts,
    collaboration: {
      joint_plans: jointPlans,
      solo_plans: Math.max(0, plans.length - jointPlans),
      joint_rate_percent: jointRate,
      accepted_invites: acceptedInvites,
      pending_invites: pendingInvites,
      declined_invites: declinedInvites,
    },
    login: {
      active_7d: staffRows.filter((s) => s.login_bucket === "7d").length,
      active_30d: staffRows.filter((s) => s.login_bucket === "7d" || s.login_bucket === "30d").length,
      never_logged_in: staffRows.filter((s) => s.login_bucket === "never").length,
      older: staffRows.filter((s) => s.login_bucket === "older").length,
    },
    department_stats: [...deptPlanMap.values()].sort((a, b) => b.plans - a.plans),
    staff_with_plans: withPlans,
    staff_without_plans: withoutPlans,
    ranking,
    no_shared_reports_this_month: noSharedReports,
    recent_activity: recentLogs,
    totals: {
      staff: staffRows.length,
      with_plans: withPlans.length,
      without_plans: withoutPlans.length,
      plans: plans.length,
      completed: statusCounts.complete,
      reports_this_month: reportsThisMonth.length,
      shared_reports_this_month: reportsThisMonth.filter((r) => sharedDeptList(r).length > 0).length,
      joint_rate_percent: jointRate,
    },
  });
});
