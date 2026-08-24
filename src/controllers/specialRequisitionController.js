import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { findUserByRole, getApproverForApplicant, USER_PUBLIC } from "../services/workflowUsers.js";
import { isAdminRole, isDirectApplicant, isEdRole, isExecutiveRole, isLogisticRole } from "../utils/roleHelpers.js";

const USER_ATTR = { attributes: USER_PUBLIC };
const VU_TYPES = ["Car Wash", "Fueling", "Repair", "Official Duty", "Other"];
const TRANSITIONS = {
  pending: ["verification_process", "approved", "rejected", "reverted"],
  verification_process: ["approved", "reverted", "rejected"],
  reverted: ["pending"],
  rejected: [],
  approved: [],
  authorized: [],
};

const detailInclude = [
  { model: db.Department, as: "department", attributes: ["id", "name"] },
  { model: db.Users, as: "preparer", ...USER_ATTR },
  { model: db.Users, as: "sendToUser", ...USER_ATTR },
  { model: db.Users, as: "coordinator", ...USER_ATTR },
  { model: db.Users, as: "executiveUser", ...USER_ATTR },
  { model: db.Users, as: "verifier", ...USER_ATTR },
  { model: db.Users, as: "approver", ...USER_ATTR },
  { model: db.Users, as: "authorizer", ...USER_ATTR },
  {
    model: db.SpecialRequisitionLogs,
    as: "special_requisition_logs_special_requisition_id",
    include: [{ model: db.Users, as: "changedByUser", attributes: ["id", "names", "email", "role"] }],
  },
];

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  const map = {
    verified_by_logistic: "verification_process",
    verified_by_coordinator: "verification_process",
    rejected_by_logistic: "rejected",
    rejected_by_coordinator: "rejected",
    rejected_by_ed: "rejected",
  };
  return map[value] || value;
}

function canAccess(user, row) {
  if (isAdminRole(user.role) || isExecutiveRole(user.role) || isLogisticRole(user.role)) return true;
  const id = Number(user.id);
  return [row.prepared_by, row.sended_to, row.coordinator_id, row.executive_id, row.viewer_id].some(
    (value) => Number(value) === id
  );
}

async function addVuLog(id, status, userId, comment) {
  await db.SpecialRequisitionLogs.create({
    special_requisition_id: id,
    status,
    changed_by: userId,
    comment: comment || null,
  });
}

async function loadRow(id) {
  return db.SpecialRequisitions.findByPk(id, {
    include: detailInclude,
    order: [[{ model: db.SpecialRequisitionLogs, as: "special_requisition_logs_special_requisition_id" }, "id", "ASC"]],
  });
}

export const getVehicleUtilizations = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const tab = req.query.tab || "my";
  const search = String(req.query.search || "").trim();
  const where = {};

  if (tab === "received") {
    if (!isLogisticRole(req.user.role) && !isExecutiveRole(req.user.role) && !isAdminRole(req.user.role)) {
      return fail(res, "Access denied", 403);
    }
    if (!isExecutiveRole(req.user.role)) {
      where.prepared_by = { [Op.ne]: req.user.id };
    }
  } else if (tab === "all" && (isAdminRole(req.user.role) || isExecutiveRole(req.user.role) || isLogisticRole(req.user.role))) {
    // no owner filter
  } else {
    where.prepared_by = req.user.id;
  }

  if (req.query.status) where.status = req.query.status;
  if (req.query.type) where.type = req.query.type;
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

  const { rows, count } = await db.SpecialRequisitions.findAndCountAll({
    where,
    include: [
      { model: db.Department, as: "department", attributes: ["id", "name"] },
      { model: db.Users, as: "preparer", attributes: ["id", "names", "email", "role"] },
    ],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getVehicleUtilization = asyncHandler(async (req, res) => {
  const row = await loadRow(req.params.id);
  if (!row) return fail(res, "Vehicle utilization not found", 404);
  if (!canAccess(req.user, row)) return fail(res, "Access denied", 403);
  const status = normalizeStatus(row.status);
  const isDirect = !row.coordinator_id && isDirectApplicant(row.preparer?.role);
  return ok(res, {
    ...row.toJSON(),
    status,
    permissions: {
      can_edit: Number(row.prepared_by) === Number(req.user.id) && ["reverted", "pending", "edited"].includes(status),
      can_logistic_act: isLogisticRole(req.user.role) && ["pending", "verification_process"].includes(status),
      can_executive_act: isDirect && Number(row.executive_id) === Number(req.user.id) && status === "pending",
      can_ed_authorize: isEdRole(req.user.role) && !row.authorized_by && ["verification_process", "approved"].includes(status),
    },
  });
});

export const createVehicleUtilization = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const date = body.date;
  let type = VU_TYPES.includes(body.type) ? body.type : "Other";
  const type_other = type === "Other" ? String(body.type_other || "").trim() : "";
  if (!title || !date || !description) return fail(res, "title, date, and description are required");
  if (type === "Other" && !type_other) return fail(res, "Please specify the type when Other is selected");

  const department_id = body.department_id || req.user.department_ID;
  if (!department_id) return fail(res, "department_id is required");

  const coordinator = await findUserByRole("Membership Coordinator");
  const { executive, direct } = await getApproverForApplicant(req.user.role);
  if (!direct && !coordinator) return fail(res, "Membership Coordinator account not found. Please contact admin.");
  if (!executive) return fail(res, "Executive approver (ED/Chairman) not found. Please contact admin.");

  const coordinatorId = direct ? 0 : coordinator.id;
  const row = await db.SpecialRequisitions.create({
    title,
    description,
    start_time: body.start_time || null,
    end_time: body.end_time || null,
    type,
    type_other: type_other || null,
    date,
    department_id,
    prepared_by: req.user.id,
    coordinator_id: coordinatorId || null,
    sended_to: coordinatorId || 0,
    executive_id: executive.id,
    coordinator_verification_status: "pending",
    executive_verification_status: "pending",
    status: "pending",
  });
  await addVuLog(
    row.id,
    "pending",
    req.user.id,
    direct ? "Vehicle utilization submitted (direct ED/Chairman approval)" : "Vehicle utilization submitted to Logistic (Membership Coordinator)"
  );
  await createLog(req.user.id, "create_vehicle_utilization", `Created vehicle utilization #${row.id}`);

  const notifyId = direct ? executive.id : coordinatorId;
  const loaded = await loadRow(row.id);
  await createNotification({
      whatsapp: true,
    receiverId: notifyId,
    type: "vehicle_utilization_review",
    title: direct
      ? `Vehicle Utilization #${row.id} – Your Approval Required`
      : `Vehicle Utilization #${row.id} – Pending Logistic Verification`,
    message: `${req.user.names} submitted vehicle utilization "${title}".`,
    link: `/special-requisitions/${row.id}`,
    emailPayload: buildEmailPayload("vehicle", loaded, {
      intro: direct
        ? `${req.user.names} has submitted a vehicle utilization request that requires your direct approval.`
        : `${req.user.names} has submitted a vehicle utilization request for logistic verification.`,
      actor: req.user,
      actionRequired: direct
        ? "Please review the request details below and approve or reject."
        : "Please verify the vehicle utilization details and forward for executive authorization.",
    }),
  });
  return created(res, loaded, "Vehicle utilization submitted");
});

export const updateVehicleUtilization = asyncHandler(async (req, res) => {
  const row = await db.SpecialRequisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Vehicle utilization not found", 404);
  if (Number(row.prepared_by) !== Number(req.user.id)) return fail(res, "Access denied", 403);
  const status = normalizeStatus(row.status);
  if (!["reverted", "pending", "edited"].includes(status)) {
    return fail(res, "Vehicle utilization cannot be edited in its current status");
  }

  const body = req.body || {};
  const type = VU_TYPES.includes(body.type) ? body.type : row.type;
  const type_other = type === "Other" ? String(body.type_other || row.type_other || "").trim() : "";
  if (type === "Other" && !type_other) return fail(res, "Please specify the type when Other is selected");

  const coordinator = await findUserByRole("Membership Coordinator");
  const { executive, direct } = await getApproverForApplicant(req.user.role);
  const coordinatorId = direct ? 0 : coordinator?.id || row.coordinator_id;

  await row.update({
    title: body.title || row.title,
    description: body.description !== undefined ? body.description : row.description,
    start_time: body.start_time !== undefined ? body.start_time : row.start_time,
    end_time: body.end_time !== undefined ? body.end_time : row.end_time,
    type,
    type_other: type_other || null,
    date: body.date || row.date,
    coordinator_id: coordinatorId || null,
    sended_to: coordinatorId || 0,
    executive_id: executive?.id || row.executive_id,
    coordinator_verification_status: "pending",
    executive_verification_status: "pending",
    coordinator_verified_at: null,
    coordinator_signature: null,
    executive_signature: null,
    executive_approved_at: null,
    verified_by: null,
    verified_at: null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    reason: null,
    reverted_by: null,
    reverted_at: null,
    reversion_reason: null,
    status: "pending",
  });
  await addVuLog(row.id, "edited", req.user.id, "Request edited and resubmitted");
  return ok(res, await loadRow(row.id), "Vehicle utilization updated");
});

export const updateVehicleUtilizationStatus = asyncHandler(async (req, res) => {
  const row = await db.SpecialRequisitions.findByPk(req.params.id, {
    include: [{ model: db.Users, as: "preparer", attributes: ["id", "names", "email", "role"] }],
  });
  if (!row) return fail(res, "Vehicle utilization not found", 404);

  const current = normalizeStatus(row.status);
  const status = String(req.body.status || "").trim();
  const comment = String(req.body.comment || "").trim();
  const reason = String(req.body.reason || comment || "").trim();
  const isDirect = !row.coordinator_id && isDirectApplicant(row.preparer?.role);
  const canLogistic = isLogisticRole(req.user.role);
  const canExecutive = isDirect && Number(row.executive_id) === Number(req.user.id);
  if (!canLogistic && !canExecutive && !isAdminRole(req.user.role)) {
    return fail(res, "Only Logistic (Membership Coordinator) can perform this action.", 403);
  }
  if (!((TRANSITIONS[current] || []).includes(status))) {
    return fail(res, `Invalid status transition from ${current} to ${status}`);
  }

  const patch = { status };
  if (status === "verification_process") {
    patch.verified_by = req.user.id;
    patch.verified_at = new Date();
    patch.coordinator_verification_status = "verified";
    patch.coordinator_verified_at = new Date();
  } else if (status === "approved") {
    patch.approved_by = req.user.id;
    patch.approved_at = new Date();
    if (current === "pending") {
      patch.verified_by = req.user.id;
      patch.verified_at = new Date();
    }
  } else if (status === "rejected") {
    patch.rejected_by = req.user.id;
    patch.rejected_at = new Date();
    patch.rejection_reason = reason || "Rejected";
  } else if (status === "reverted") {
    patch.reverted_by = req.user.id;
    patch.reverted_at = new Date();
    patch.reversion_reason = reason || "Reverted for corrections";
  }
  if (comment) patch.comment = comment;
  await row.update(patch);

  let logComment = comment || `Status changed to ${status}`;
  if (status === "verification_process") logComment = comment || "Verified By Logistic (Membership Coordinator)";
  await addVuLog(row.id, status, req.user.id, logComment);
  await createLog(req.user.id, `vehicle_utilization_${status}`, `Vehicle utilization #${row.id} ${status}`);

  const loaded = await loadRow(row.id);

  if (row.prepared_by) {
    await createNotification({
      whatsapp: true,
      receiverId: row.prepared_by,
      type: "vehicle_utilization_status",
      title: `Vehicle Utilization #${row.id} ${status.replace(/_/g, " ")}`,
      message: reason || comment || `Your vehicle utilization is now ${status.replace(/_/g, " ")}.`,
      link: `/special-requisitions/${row.id}`,
      emailPayload: buildEmailPayload("vehicle", loaded, {
        intro: `Your vehicle utilization request #${row.id} has been updated to "${status.replace(/_/g, " ")}".`,
        actor: req.user,
        note: reason || comment,
        actionRequired: status === "reverted" ? "Please review the comment, update your request, and resubmit." : undefined,
      }),
    });
  }
  if (["verification_process", "approved"].includes(status)) {
    const ed = await findUserByRole("ED");
    if (ed) {
      await createNotification({
      whatsapp: true,
        receiverId: ed.id,
        type: "vehicle_utilization_review",
        title: `Vehicle Utilization #${row.id} – Ready for ED Authorization`,
        message: `Request "${row.title}" is ready for Executive Director authorization.`,
        link: `/special-requisitions/${row.id}`,
        emailPayload: buildEmailPayload("vehicle", loaded, {
          intro: `Vehicle utilization request "${row.title}" has been verified and is ready for Executive Director authorization.`,
          actor: req.user,
          note: comment,
          actionRequired: "Please review the request details below and authorize when satisfied.",
        }),
      });
    }
  }
  return ok(res, loaded, "Vehicle utilization status updated");
});

export const authorizeVehicleUtilization = asyncHandler(async (req, res) => {
  const row = await db.SpecialRequisitions.findByPk(req.params.id);
  if (!row) return fail(res, "Vehicle utilization not found", 404);
  if (!isEdRole(req.user.role)) return fail(res, "Only the Executive Director can authorize", 403);
  const status = normalizeStatus(row.status);
  if (row.authorized_by) return fail(res, "This request is already authorized");
  if (!["verification_process", "approved"].includes(status)) {
    return fail(res, "This request is not ready for ED authorization");
  }

  await row.update({
    authorized_by: req.user.id,
    authorized_at: new Date(),
    status: "authorized",
    ed_signature_and_stamp: req.body.ed_signature_and_stamp
      ? String(req.body.ed_signature_and_stamp)
      : row.ed_signature_and_stamp,
  });
  await addVuLog(row.id, "authorized", req.user.id, "Authorized by ED");
  if (row.prepared_by) {
    const loaded = await loadRow(row.id);
    await createNotification({
      whatsapp: true,
      receiverId: row.prepared_by,
      type: "vehicle_utilization_status",
      title: `Vehicle Utilization #${row.id} authorized`,
      message: "Your vehicle utilization has been authorized by the Executive Director.",
      link: `/special-requisitions/${row.id}`,
      emailPayload: buildEmailPayload("vehicle", loaded, {
        intro: "Your vehicle utilization request has been authorized by the Executive Director.",
        actor: req.user,
      }),
    });
  }
  return ok(res, await loadRow(row.id), "Vehicle utilization authorized");
});
