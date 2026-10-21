import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { USER_PUBLIC } from "../services/workflowUsers.js";
import { userHasPrivilege } from "../services/privilegeService.js";
import {
  isAdminRole,
  isEdRole,
  isExecutiveRole,
  isLogisticRole,
} from "../utils/roleHelpers.js";

const USER_ATTR = { attributes: USER_PUBLIC };
const SUPPLY_TYPES = ["kitchen", "hygienic"];
const LOGISTIC_ROLES = ["logistic", "membership coordinator"];

function canManageSupply(user) {
  return (
    isLogisticRole(user) ||
    isEdRole(user) ||
    isAdminRole(user) ||
    isExecutiveRole(user) ||
    userHasPrivilege(user, "supply.manage") ||
    (Array.isArray(user?.privilege_codes) && user.privilege_codes.includes("supply.manage"))
  );
}

function canAuthorizeSupply(user) {
  return (
    isEdRole(user) ||
    isExecutiveRole(user) ||
    isAdminRole(user) ||
    userHasPrivilege(user, "supply.authorize") ||
    (Array.isArray(user?.privilege_codes) && user.privilege_codes.includes("supply.authorize"))
  );
}

function canAccess(user, row) {
  if (canManageSupply(user) || canAuthorizeSupply(user)) return true;
  return Number(row.prepared_by) === Number(user.id);
}

async function findLogisticUsers() {
  return db.Users.findAll({
    where: {
      [Op.and]: [
        {
          [Op.or]: LOGISTIC_ROLES.map((role) =>
            db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("role")), role)
          ),
        },
        { deleted: { [Op.ne]: "1" } },
        { active: 1 },
      ],
    },
    attributes: USER_PUBLIC,
  });
}

async function addSupplyLog(requisitionId, action, userId, comment) {
  await db.SupplyRequisitionLogs.create({
    supply_requisition_id: requisitionId,
    action,
    comment: comment || null,
    changed_by: userId || null,
  });
}

const detailInclude = [
  { model: db.SupplyRequisitionItems, as: "items" },
  {
    model: db.SupplyRequisitionLogs,
    as: "logs",
    include: [{ model: db.Users, as: "actor", attributes: ["id", "names", "email", "role"] }],
  },
  { model: db.Users, as: "preparer", ...USER_ATTR },
  { model: db.Users, as: "assignee", ...USER_ATTR },
  { model: db.Users, as: "approver", ...USER_ATTR },
  { model: db.Users, as: "authorizer", ...USER_ATTR },
  { model: db.Department, as: "requesterDepartment", attributes: ["id", "name"] },
  { model: db.Department, as: "assignedDepartment", attributes: ["id", "name"] },
];

async function loadRow(id) {
  return db.SupplyRequisitions.findByPk(id, {
    include: detailInclude,
    order: [
      [{ model: db.SupplyRequisitionItems, as: "items" }, "item_no", "ASC"],
      [{ model: db.SupplyRequisitionLogs, as: "logs" }, "id", "ASC"],
    ],
  });
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) return null;
  return items
    .map((item, index) => ({
      item_no: index + 1,
      item_name: String(item.item_name || "").trim(),
      quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
      description: item.description != null ? String(item.description).trim() : null,
    }))
    .filter((item) => item.item_name);
}

async function replaceItems(requisitionId, items) {
  await db.SupplyRequisitionItems.destroy({ where: { supply_requisition_id: requisitionId } });
  if (!items?.length) return;
  await db.SupplyRequisitionItems.bulkCreate(
    items.map((item) => ({
      supply_requisition_id: requisitionId,
      item_no: item.item_no,
      item_name: item.item_name,
      quantity: item.quantity,
      description: item.description,
    }))
  );
}

async function notifyLogistics(requisition, actor, title, message) {
  const logistics = await findLogisticUsers();
  await Promise.all(
    logistics.map((user) =>
      createNotification({
        whatsapp: true,
        receiverId: user.id,
        type: "supply_requisition",
        title,
        message,
        link: `/supply-requisitions/${requisition.id}`,
        priority: "middle",
      })
    )
  );
}

async function notifyUser(userId, title, message, requisitionId) {
  if (!userId) return;
  await createNotification({
    whatsapp: true,
    receiverId: userId,
    type: "supply_requisition",
    title,
    message,
    link: `/supply-requisitions/${requisitionId}`,
    priority: "middle",
  });
}

export const listSupplyRequisitions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const tab = String(req.query.tab || "my").toLowerCase();
  const search = String(req.query.search || "").trim();
  const where = {};

  if (tab === "logistic") {
    if (!canManageSupply(req.user)) return fail(res, "Access denied", 403);
    where.status = { [Op.in]: ["pending", "assigned", "approved", "authorized", "rejected"] };
  } else if (tab === "all") {
    if (!canManageSupply(req.user) && !canAuthorizeSupply(req.user)) {
      return fail(res, "Access denied", 403);
    }
  } else {
    where.prepared_by = req.user.id;
  }

  if (req.query.status) where.status = req.query.status;
  if (req.query.supply_type) where.supply_type = String(req.query.supply_type).toLowerCase();
  if (search) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { notes: { [Op.like]: `%${search}%` } },
          { reject_reason: { [Op.like]: `%${search}%` } },
          { supply_type: { [Op.like]: `%${search}%` } },
        ],
      },
    ];
  }

  const { rows, count } = await db.SupplyRequisitions.findAndCountAll({
    where,
    include: [
      { model: db.Users, as: "preparer", attributes: ["id", "names", "email", "role"] },
      { model: db.Users, as: "assignee", attributes: ["id", "names", "email", "role"] },
      { model: db.Department, as: "requesterDepartment", attributes: ["id", "name"] },
      { model: db.Department, as: "assignedDepartment", attributes: ["id", "name"] },
      { model: db.SupplyRequisitionItems, as: "items" },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getSupplyRequisition = asyncHandler(async (req, res) => {
  const row = await loadRow(req.params.id);
  if (!row) return fail(res, "Supply requisition not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  return ok(res, row);
});

export const createSupplyRequisition = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const supply_type = String(body.supply_type || "").trim().toLowerCase();
  if (!SUPPLY_TYPES.includes(supply_type)) {
    return fail(res, "supply_type must be kitchen or hygienic");
  }

  const items = normalizeItems(body.items);
  if (!items?.length) return fail(res, "At least one item with item_name is required");

  const submit = body.submit === true || body.submit === 1 || body.submit === "1" || body.submit === "true";
  const status = submit ? "pending" : "draft";

  const row = await db.SupplyRequisitions.create({
    supply_type,
    status,
    prepared_by: req.user.id,
    requester_department_id: req.user.department_ID || body.requester_department_id || null,
    notes: body.notes != null ? String(body.notes).trim() : null,
  });

  await replaceItems(row.id, items);
  await addSupplyLog(
    row.id,
    submit ? "submitted" : "created",
    req.user.id,
    submit ? "Supply requisition submitted to logistic" : "Supply requisition draft created"
  );
  await createLog(
    req.user.id,
    submit ? "submit_supply_requisition" : "create_supply_requisition",
    `${submit ? "Submitted" : "Created"} supply requisition #${row.id}`
  );

  if (submit) {
    await notifyLogistics(
      row,
      req.user,
      `Supply Requisition #${row.id} – Pending Review`,
      `${req.user.names} submitted a ${supply_type} supply requisition.`
    );
  }

  return created(res, await loadRow(row.id), submit ? "Supply requisition submitted" : "Supply requisition draft created");
});

export const updateSupplyRequisition = asyncHandler(async (req, res) => {
  const row = await db.SupplyRequisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Supply requisition not found", 404);
  if (Number(row.prepared_by) !== Number(req.user.id)) return fail(res, "Access denied", 403);
  if (!["draft", "reverted"].includes(row.status)) {
    return fail(res, "Only draft or reverted requisitions can be updated");
  }

  const body = req.body || {};
  const patch = {};
  if (body.supply_type !== undefined) {
    const supply_type = String(body.supply_type || "").trim().toLowerCase();
    if (!SUPPLY_TYPES.includes(supply_type)) {
      return fail(res, "supply_type must be kitchen or hygienic");
    }
    patch.supply_type = supply_type;
  }
  if (body.notes !== undefined) patch.notes = body.notes != null ? String(body.notes).trim() : null;

  if (Object.keys(patch).length) await row.update(patch);

  if (body.items !== undefined) {
    const items = normalizeItems(body.items);
    if (!items?.length) return fail(res, "At least one item with item_name is required");
    await replaceItems(row.id, items);
  }

  await addSupplyLog(row.id, "updated", req.user.id, "Draft updated");
  await createLog(req.user.id, "update_supply_requisition", `Updated supply requisition #${row.id}`);
  return ok(res, await loadRow(row.id), "Supply requisition updated");
});

export const submitSupplyRequisition = asyncHandler(async (req, res) => {
  const row = await db.SupplyRequisitions.findByPk(req.params.id, {
    include: [{ model: db.SupplyRequisitionItems, as: "items" }],
  });
  if (!row) return fail(res, "Supply requisition not found", 404);
  if (Number(row.prepared_by) !== Number(req.user.id)) return fail(res, "Access denied", 403);
  if (!["draft", "reverted"].includes(row.status)) {
    return fail(res, "Only draft or reverted requisitions can be submitted");
  }
  if (!row.items?.length) return fail(res, "Add at least one item before submitting");

  await row.update({
    status: "pending",
    rejected_by: null,
    reverted_by: null,
    reject_reason: null,
  });
  await addSupplyLog(row.id, "submitted", req.user.id, "Submitted to logistic");
  await createLog(req.user.id, "submit_supply_requisition", `Submitted supply requisition #${row.id}`);
  await notifyLogistics(
    row,
    req.user,
    `Supply Requisition #${row.id} – Pending Review`,
    `${req.user.names} submitted a ${row.supply_type} supply requisition.`
  );
  return ok(res, await loadRow(row.id), "Supply requisition submitted");
});

export const assignSupplyRequisition = asyncHandler(async (req, res) => {
  if (!canManageSupply(req.user)) return fail(res, "Access denied", 403);
  const row = await db.SupplyRequisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Supply requisition not found", 404);
  if (!["pending", "assigned"].includes(row.status)) {
    return fail(res, "Only pending or assigned requisitions can be assigned");
  }

  const assigned_department_id = req.body.assigned_department_id
    ? Number(req.body.assigned_department_id)
    : null;
  const assigned_to = req.body.assigned_to ? Number(req.body.assigned_to) : null;
  if (!assigned_department_id && !assigned_to) {
    return fail(res, "assigned_department_id or assigned_to is required");
  }

  await row.update({
    status: "assigned",
    assigned_department_id: assigned_department_id || row.assigned_department_id,
    assigned_to: assigned_to || row.assigned_to,
  });
  await addSupplyLog(
    row.id,
    "assigned",
    req.user.id,
    req.body.comment || `Assigned to user #${assigned_to || "n/a"} / dept #${assigned_department_id || "n/a"}`
  );
  await createLog(req.user.id, "assign_supply_requisition", `Assigned supply requisition #${row.id}`);

  await notifyUser(
    row.prepared_by,
    `Supply Requisition #${row.id} Assigned`,
    `Your supply requisition has been assigned for processing.`,
    row.id
  );
  if (assigned_to) {
    await notifyUser(
      assigned_to,
      `Supply Requisition #${row.id} Assigned to You`,
      `${req.user.names} assigned a supply requisition to you.`,
      row.id
    );
  }

  return ok(res, await loadRow(row.id), "Supply requisition assigned");
});

export const approveSupplyRequisition = asyncHandler(async (req, res) => {
  if (!canManageSupply(req.user)) return fail(res, "Access denied", 403);
  const row = await db.SupplyRequisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Supply requisition not found", 404);
  if (row.status !== "assigned") {
    return fail(res, "Only assigned requisitions can be approved");
  }

  await row.update({ status: "approved", approved_by: req.user.id });
  await addSupplyLog(row.id, "approved", req.user.id, req.body.comment || "Approved by logistic");
  await createLog(req.user.id, "approve_supply_requisition", `Approved supply requisition #${row.id}`);
  await notifyUser(
    row.prepared_by,
    `Supply Requisition #${row.id} Approved`,
    `Your supply requisition was approved and awaits authorization.`,
    row.id
  );

  const authorizerRoles = ["ed", "chairman", "admin"];
  const authorizers = await db.Users.findAll({
    where: {
      [Op.and]: [
        {
          [Op.or]: authorizerRoles.map((role) =>
            db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("role")), role)
          ),
        },
        { deleted: { [Op.ne]: "1" } },
        { active: 1 },
      ],
    },
    attributes: ["id"],
  });
  await Promise.all(
    authorizers.map((user) =>
      notifyUser(
        user.id,
        `Supply Requisition #${row.id} – Ready for Authorization`,
        `A ${row.supply_type} supply requisition is ready for authorization.`,
        row.id
      )
    )
  );

  return ok(res, await loadRow(row.id), "Supply requisition approved");
});

export const rejectSupplyRequisition = asyncHandler(async (req, res) => {
  if (!canManageSupply(req.user)) return fail(res, "Access denied", 403);
  const row = await db.SupplyRequisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Supply requisition not found", 404);
  if (!["pending", "assigned"].includes(row.status)) {
    return fail(res, "Only pending or assigned requisitions can be rejected");
  }

  const reason = String(req.body.reason || req.body.comment || "").trim() || "Rejected";
  await row.update({
    status: "rejected",
    rejected_by: req.user.id,
    reject_reason: reason,
  });
  await addSupplyLog(row.id, "rejected", req.user.id, reason);
  await createLog(req.user.id, "reject_supply_requisition", `Rejected supply requisition #${row.id}`);
  await notifyUser(
    row.prepared_by,
    `Supply Requisition #${row.id} Rejected`,
    reason,
    row.id
  );
  return ok(res, await loadRow(row.id), "Supply requisition rejected");
});

export const revertSupplyRequisition = asyncHandler(async (req, res) => {
  if (!canManageSupply(req.user)) return fail(res, "Access denied", 403);
  const row = await db.SupplyRequisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Supply requisition not found", 404);
  if (!["pending", "assigned"].includes(row.status)) {
    return fail(res, "Only pending or assigned requisitions can be reverted");
  }

  const reason = String(req.body.reason || req.body.comment || "").trim() || "Reverted for corrections";
  await row.update({
    status: "reverted",
    reverted_by: req.user.id,
    reject_reason: reason,
    assigned_to: null,
    assigned_department_id: null,
    approved_by: null,
  });
  await addSupplyLog(row.id, "reverted", req.user.id, reason);
  await createLog(req.user.id, "revert_supply_requisition", `Reverted supply requisition #${row.id}`);
  await notifyUser(
    row.prepared_by,
    `Supply Requisition #${row.id} Reverted`,
    reason,
    row.id
  );
  return ok(res, await loadRow(row.id), "Supply requisition reverted");
});

export const authorizeSupplyRequisition = asyncHandler(async (req, res) => {
  if (!canAuthorizeSupply(req.user)) {
    return fail(res, "Only ED / authorized roles can authorize supply requisitions", 403);
  }
  const row = await db.SupplyRequisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Supply requisition not found", 404);
  if (row.status !== "approved") {
    return fail(res, "Only approved requisitions can be authorized");
  }

  await row.update({ status: "authorized", authorized_by: req.user.id });
  await addSupplyLog(row.id, "authorized", req.user.id, req.body.comment || "Authorized by ED");
  await createLog(req.user.id, "authorize_supply_requisition", `Authorized supply requisition #${row.id}`);
  await notifyUser(
    row.prepared_by,
    `Supply Requisition #${row.id} Authorized`,
    `Your supply requisition has been authorized.`,
    row.id
  );
  if (row.assigned_to) {
    await notifyUser(
      row.assigned_to,
      `Supply Requisition #${row.id} Authorized`,
      `Supply requisition #${row.id} has been authorized.`,
      row.id
    );
  }
  return ok(res, await loadRow(row.id), "Supply requisition authorized");
});
