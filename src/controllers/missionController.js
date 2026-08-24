import { Op } from "sequelize";
import asyncHandler from "express-async-handler";
import db from "../database/models/index.js";
import { ok, fail, created } from "../utils/apiResponse.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";
import { createLog } from "../services/logService.js";
import { createNotification } from "../services/notificationService.js";
import { buildEmailPayload } from "../services/emailNotificationHelpers.js";
import { getApproverForApplicant, hasSignature, normalizeEdStampChoice, USER_PUBLIC } from "../services/workflowUsers.js";
import {
  isAdminRole,
  isDirectApplicant,
  isEdRole,
  isExactHr,
  isExecutiveRole,
  canReviewWorkflow,
} from "../utils/roleHelpers.js";

const USER_ATTR = { attributes: USER_PUBLIC };
const detailInclude = [
  { model: db.Users, as: "user", ...USER_ATTR, include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }] },
  { model: db.Users, as: "hr", ...USER_ATTR },
  { model: db.Users, as: "executive", ...USER_ATTR },
  {
    model: db.MissionRequestLogs,
    as: "logs",
    include: [{ model: db.Users, as: "changedByUser", attributes: ["id", "names", "email", "role"] }],
  },
];

function applicantRole(row) {
  return row.user?.role || row.applicant_role || "";
}

function isSpecialCase(row) {
  return isDirectApplicant(applicantRole(row));
}

function canAccessMission(user, row) {
  if (!row) return false;
  if (isAdminRole(user.role) || isExecutiveRole(user.role)) return true;
  if (row.user_id === user.id) return true;
  if (isExactHr(user.role)) return !isSpecialCase(row);
  return false;
}

function canEditMission(user, row) {
  const status = row.mission_requests_status;
  if (isExactHr(user.role) && !isSpecialCase(row)) return true;
  if (isExecutiveRole(user.role)) return status !== "approved";
  if (row.user_id === user.id) {
    return !["verified_by_hr", "approved", "rejected", "rejected_by_hr", "rejected_by_ed"].includes(status);
  }
  return false;
}

function canDeleteMission(user, row) {
  if (isExactHr(user.role) && !isSpecialCase(row)) return true;
  return row.user_id === user.id && row.mission_requests_status === "pending";
}

function isDesignatedApprover(user, row) {
  return isExecutiveRole(user.role) && Number(row.executive_id) === Number(user.id);
}

function allowApprove(row) {
  return (
    row.mission_requests_status === "verified_by_hr" ||
    (isSpecialCase(row) && row.mission_requests_status === "pending")
  );
}

async function addMissionLog(requestId, status, userId, comment) {
  await db.MissionRequestLogs.create({
    request_id: requestId,
    status,
    changed_by: userId,
    comment: comment || null,
  });
}

async function loadMission(id) {
  return db.MissionRequests.findByPk(id, {
    include: detailInclude,
    order: [[{ model: db.MissionRequestLogs, as: "logs" }, "id", "ASC"]],
  });
}

export const getMissions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req);
  const tab = req.query.tab || "my";
  const search = String(req.query.search || "").trim();
  const where = {};

  if (tab === "received") {
    if (!canReviewWorkflow(req.user.role)) {
      return fail(res, "Access denied", 403);
    }
    if (isExactHr(req.user.role) || isAdminRole(req.user.role)) {
      where.user_id = { [Op.ne]: req.user.id };
    } else if (isExecutiveRole(req.user.role)) {
      const counterpart = isEdRole(req.user.role) ? "Chairman" : "ED";
      where[Op.or] = [
        {
          hr_verification_status: "verified",
          mission_requests_status: "verified_by_hr",
        },
        { mission_requests_status: "approved" },
        {
          mission_requests_status: "pending",
          hr_id: { [Op.or]: [null, 0] },
          "$user.role$": counterpart,
        },
      ];
    }
  } else {
    where.user_id = req.user.id;
  }

  if (req.query.status) where.mission_requests_status = req.query.status;
  if (req.query.user_id && tab === "received") where.user_id = req.query.user_id;
  if (req.query.date_from) where.created_at = { ...(where.created_at || {}), [Op.gte]: req.query.date_from };
  if (req.query.date_to) where.created_at = { ...(where.created_at || {}), [Op.lte]: req.query.date_to };
  if (search) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      {
        [Op.or]: [
          { destination: { [Op.iLike]: `%${search}%` } },
          { purpose: { [Op.iLike]: `%${search}%` } },
          { "$user.names$": { [Op.iLike]: `%${search}%` } },
        ],
      },
    ];
  }

  const { rows, count } = await db.MissionRequests.findAndCountAll({
    where,
    include: [{ model: db.Users, as: "user", ...USER_ATTR }],
    order: [["created_at", "DESC"]],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  });

  return ok(res, { items: rows, pagination: paginationMeta(count, page, limit) });
});

export const getMissionCounts = asyncHandler(async (req, res) => {
  const my = await db.MissionRequests.count({ where: { user_id: req.user.id } });
  let received = 0;
  if (canReviewWorkflow(req.user.role)) {
    if (isExactHr(req.user.role) || isAdminRole(req.user.role)) {
      received = await db.MissionRequests.count({ where: { user_id: { [Op.ne]: req.user.id } } });
    } else {
      const counterpart = isEdRole(req.user.role) ? "Chairman" : "ED";
      received = await db.MissionRequests.count({
        include: [{ model: db.Users, as: "user", attributes: [] }],
        where: {
          [Op.or]: [
            { hr_verification_status: "verified", mission_requests_status: "verified_by_hr" },
            { mission_requests_status: "approved" },
            { mission_requests_status: "pending", hr_id: { [Op.or]: [null, 0] }, "$user.role$": counterpart },
          ],
        },
        distinct: true,
      });
    }
  }
  return ok(res, { my, received });
});

export const getMission = asyncHandler(async (req, res) => {
  const row = await loadMission(req.params.id);
  if (!row) return fail(res, "Mission request not found", 404);
  if (!canAccessMission(req.user, row)) return fail(res, "Access denied", 403);
  return ok(res, {
    ...row.toJSON(),
    permissions: {
      can_edit: canEditMission(req.user, row),
      can_delete: canDeleteMission(req.user, row),
      can_hr_act: isExactHr(req.user.role) && !isSpecialCase(row),
      can_approve: isDesignatedApprover(req.user, row) && allowApprove(row),
      can_reject:
        (isExactHr(req.user.role) && !isSpecialCase(row)) ||
        (isDesignatedApprover(req.user, row) && allowApprove(row)),
      is_special_case: isSpecialCase(row),
    },
  });
});

export const createMission = asyncHandler(async (req, res) => {
  const destination = String(req.body.destination || "").trim();
  const purpose = String(req.body.purpose || "").trim();
  const departure_date = req.body.departure_date;
  const return_date = req.body.return_date;
  const days = Number(req.body.days_requested || req.body.days_manual || 0);
  const vihicle_prack = String(req.body.vihicle_prack || "").trim() || null;

  if (!destination || !purpose || !departure_date || !return_date || days < 1) {
    return fail(res, "destination, purpose, departure_date, return_date, and days_requested (min 1) are required");
  }

  const officers = await getApproverForApplicant(req.user.role);
  if (!officers.executive) {
    return fail(res, "Executive Director account not found. Cannot proceed.");
  }
  if (!officers.direct && !officers.hr) {
    return fail(res, "HR account not found. Cannot proceed.");
  }

  const year = new Date(departure_date).getFullYear();
  const row = await db.MissionRequests.create({
    user_id: req.user.id,
    destination,
    purpose,
    departure_date,
    return_date,
    days_requested: days,
    days_authorized: days,
    year,
    hr_id: officers.hr?.id || null,
    executive_id: officers.executive.id,
    chairman_id: officers.chairman?.id || null,
    mission_requests_status: "pending",
    hr_verification_status: "pending",
    submitted_by_hr: req.user.id,
    vihicle_prack,
  });

  await addMissionLog(
    row.id,
    "pending",
    req.user.id,
    officers.direct
      ? "Mission request submitted (direct ED/Chairman approval)"
      : "Mission request submitted by employee"
  );
  await createLog(req.user.id, "create_mission", `Created mission request #${row.id}`);

  const link = `/missions/${row.id}`;
  if (officers.direct) {
    await createNotification({
      whatsapp: true,
      receiverId: officers.executive.id,
      type: "mission_request",
      title: `Mission Request #${row.id} – Your Approval Required`,
      message: `${req.user.names} submitted a mission request. Please approve or reject.`,
      link,
      emailPayload: buildEmailPayload("mission", row, {
        intro: `${req.user.names} has submitted a mission request that requires your direct approval as Executive Director / Chairman.`,
        actor: req.user,
        actionRequired: "Please review the mission details below and approve or reject this request.",
      }),
    });
  } else {
    await createNotification({
      whatsapp: true,
      receiverId: officers.hr.id,
      type: "mission_request",
      title: `New Mission Request #${row.id}`,
      message: `${req.user.names} submitted mission request #${row.id} to ${destination}.`,
      link,
      emailPayload: buildEmailPayload("mission", row, {
        intro: `${req.user.names} has submitted a new mission request for HR verification.`,
        actor: req.user,
        actionRequired: "Please verify the mission details and forward the request for executive approval.",
      }),
    });
  }

  return created(res, await loadMission(row.id), "Mission request created");
});

export const updateMission = asyncHandler(async (req, res) => {
  const row = await loadMission(req.params.id);
  if (!row) return fail(res, "Mission request not found", 404);
  if (!canAccessMission(req.user, row) || !canEditMission(req.user, row)) {
    return fail(res, "You cannot edit this mission request", 403);
  }

  const destination = String(req.body.destination || row.destination).trim();
  const purpose = String(req.body.purpose || row.purpose).trim();
  const departure_date = req.body.departure_date || row.departure_date;
  const return_date = req.body.return_date || row.return_date;
  const days = Number(req.body.days_requested || req.body.days_manual || row.days_requested);
  if (days < 1) return fail(res, "Number of days must be at least 1");

  await row.update({
    destination,
    purpose,
    departure_date,
    return_date,
    days_requested: days,
    year: new Date(departure_date).getFullYear(),
    vihicle_prack: req.body.vihicle_prack !== undefined ? req.body.vihicle_prack : row.vihicle_prack,
    mission_requests_status: "edited",
    hr_verification_status: "pending",
    hr_verified_at: null,
    hr_signature: null,
    executive_verification_status: "pending",
    executive_approved_at: null,
    executive_signature: null,
  });

  await addMissionLog(
    row.id,
    "edited",
    req.user.id,
    `Request edited by ${req.user.names}. Status set to edited.`
  );
  await createLog(req.user.id, "update_mission", `Edited mission request #${row.id}`);

  if (!isSpecialCase(row) && row.hr_id) {
    await createNotification({
      whatsapp: true,
      receiverId: row.hr_id,
      type: "mission_approval",
      title: `Mission Request #${row.id} - Edited`,
      message: `Mission request by ${row.user?.names || "applicant"} has been edited and requires your review.`,
      link: `/missions/${row.id}`,
      emailPayload: buildEmailPayload("mission", row, {
        intro: `The mission request below was edited by ${req.user.names} and needs HR review again.`,
        actor: req.user,
        actionRequired: "Please review the updated mission information and verify the request.",
      }),
    });
  }

  return ok(res, await loadMission(row.id), "Mission request updated");
});

export const deleteMission = asyncHandler(async (req, res) => {
  const row = await loadMission(req.params.id);
  if (!row) return fail(res, "Mission request not found", 404);
  if (!canDeleteMission(req.user, row)) return fail(res, "You cannot delete this mission request", 403);

  await addMissionLog(row.id, "deleted", req.user.id, "Request deleted by user");
  await db.MissionRequestLogs.destroy({ where: { request_id: row.id } });
  await row.destroy();
  await createLog(req.user.id, "delete_mission", `Deleted mission request #${req.params.id}`);
  return ok(res, null, "Mission request deleted");
});

export const verifyMissionByHr = asyncHandler(async (req, res) => {
  const row = await loadMission(req.params.id);
  if (!row) return fail(res, "Mission request not found", 404);
  if (!isExactHr(req.user.role) || isSpecialCase(row)) return fail(res, "Access denied", 403);
  if (!hasSignature(req.user)) {
    return fail(res, "Please upload your signature in profile settings before verifying requests.");
  }

  const days_authorized = Number(req.body.days_authorized || row.days_requested);
  await row.update({
    days_authorized,
    hr_verification_status: "verified",
    hr_verified_at: new Date(),
    hr_signature: "yes",
    hr_id: row.hr_id || req.user.id,
    mission_requests_status: "verified_by_hr",
  });
  await addMissionLog(row.id, "verified_by_hr", req.user.id, req.body.comment || "Verified by HR");
  await createLog(req.user.id, "verify_mission", `HR verified mission #${row.id}`);

  const link = `/missions/${row.id}`;
  const applicant = row.user?.names || "the applicant";
  if (row.executive_id) {
    await createNotification({
      whatsapp: true,
      receiverId: row.executive_id,
      type: "mission_request",
      title: `Mission Request #${row.id} – Awaiting Your Approval`,
      message: `HR verified a mission request by ${applicant}.`,
      link,
      emailPayload: buildEmailPayload("mission", row, {
        intro: `HR has verified the mission request submitted by ${applicant}. Your approval is now required.`,
        actor: req.user,
        note: req.body.comment,
        actionRequired: "Please review the mission details below and approve or reject this request.",
      }),
    });
  }

  return ok(res, await loadMission(row.id), "Request verified by HR");
});

export const revertMissionByHr = asyncHandler(async (req, res) => {
  const row = await loadMission(req.params.id);
  if (!row) return fail(res, "Mission request not found", 404);
  if (!isExactHr(req.user.role) || isSpecialCase(row)) return fail(res, "Access denied", 403);

  const comment = String(req.body.comment || "").trim();
  await row.update({
    hr_verification_status: "pending",
    hr_verified_at: null,
    hr_signature: null,
    mission_requests_status: "reverted",
  });
  await addMissionLog(row.id, "reverted", req.user.id, comment || "Reverted by HR");
  return ok(res, await loadMission(row.id), "Request reverted");
});

export const approveMission = asyncHandler(async (req, res) => {
  const row = await loadMission(req.params.id);
  if (!row) return fail(res, "Mission request not found", 404);
  if (!isDesignatedApprover(req.user, row) || !allowApprove(row)) {
    return fail(res, "You cannot approve this mission request", 403);
  }
  if (!hasSignature(req.user)) {
    return fail(res, "Please upload your signature in profile settings before approving requests.");
  }

  const days_authorized = row.days_authorized > 0 ? row.days_authorized : row.days_requested;
  await row.update({
    days_authorized,
    executive_verification_status: "verified",
    executive_approved_at: new Date(),
    executive_signature: "yes",
    ed_signature_and_stamp: normalizeEdStampChoice(req.body.ed_signature_and_stamp),
    mission_requests_status: "approved",
  });
  await addMissionLog(row.id, "approved", req.user.id, req.body.comment || "Approved");
  await createLog(req.user.id, "approve_mission", `Approved mission #${row.id}`);

  const link = `/missions/${row.id}`;
  await createNotification({
      whatsapp: true,
    receiverId: row.user_id,
    type: "mission_request",
    title: `Mission Request #${row.id} approved`,
    message: "Your mission request has been approved.",
    link,
    emailPayload: buildEmailPayload("mission", row, {
      intro: "Your mission request has received final approval. You may proceed with the authorized mission.",
      actor: req.user,
      note: req.body.comment,
    }),
  });
  if (!isSpecialCase(row) && row.hr_id) {
    await createNotification({
      whatsapp: true,
      receiverId: row.hr_id,
      type: "mission_request",
      title: `Mission Request #${row.id} fully approved`,
      message: `Request #${row.id} was approved by ${req.user.names}.`,
      link,
      emailPayload: buildEmailPayload("mission", row, {
        intro: `Mission request #${row.id} has been fully approved by ${req.user.names}.`,
        actor: req.user,
        note: req.body.comment,
      }),
    });
  }

  return ok(res, await loadMission(row.id), "Mission request approved");
});

export const rejectMission = asyncHandler(async (req, res) => {
  const row = await loadMission(req.params.id);
  if (!row) return fail(res, "Mission request not found", 404);

  const hrCan = isExactHr(req.user.role) && !isSpecialCase(row);
  const edCan = isDesignatedApprover(req.user, row);
  if (!hrCan && !edCan) return fail(res, "You cannot reject this mission request", 403);

  const reason = String(req.body.reason || req.body.comment || "").trim();
  const status = hrCan ? "rejected_by_hr" : "rejected_by_ed";
  await row.update({ mission_requests_status: status, reason: reason || null });
  await addMissionLog(row.id, status, req.user.id, reason || "Rejected");
  if (edCan) {
    await createNotification({
      whatsapp: true,
      receiverId: row.user_id,
      type: "mission_request",
      title: `Mission Request #${row.id} rejected`,
      message: reason ? `Your mission request was rejected. Reason: ${reason}` : "Your mission request was rejected.",
      link: `/missions/${row.id}`,
      emailPayload: buildEmailPayload("mission", row, {
        intro: "Your mission request was rejected. See the comment below for more information.",
        actor: req.user,
        note: reason,
        actionRequired: reason ? "Please review the reason and contact HR if you need clarification." : undefined,
      }),
    });
  }
  return ok(res, await loadMission(row.id), "Mission request rejected");
});

export const updateMissionSignatureChoice = asyncHandler(async (req, res) => {
  const row = await loadMission(req.params.id);
  if (!row) return fail(res, "Mission request not found", 404);
  if (!isDesignatedApprover(req.user, row)) return fail(res, "Access denied", 403);

  await row.update({
    ed_signature_and_stamp: normalizeEdStampChoice(req.body.ed_signature_and_stamp, row.ed_signature_and_stamp || "signature_only"),
  });
  await addMissionLog(row.id, "signature_choice_updated", req.user.id, "Signature/Stamp choice updated by ED");
  return ok(res, await loadMission(row.id), "Signature choice updated");
});
