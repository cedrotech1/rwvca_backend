import { Op } from "sequelize";
import db from "../database/models/index.js";
import { createNotification } from "./notificationService.js";
import { buildEmailPayload } from "./emailNotificationHelpers.js";
import { isExecutiveRole, isExactHr } from "../utils/roleHelpers.js";

const STAKEHOLDER_QUERIES = {
  requisitions: (id) => db.Requisitions.findByPk(id, { attributes: ["prepared_by"] }),
  special_requisitions: (id) => db.SpecialRequisitions.findByPk(id, { attributes: ["prepared_by"] }),
  leave_requests: (id) => db.LeaveRequests.findByPk(id, { attributes: ["user_id"] }),
  leave_schedule: (id) => db.LeaveSchedule.findByPk(id, { attributes: ["user_id"] }),
  missions: (id) => db.MissionRequests.findByPk(id, { attributes: ["user_id"] }),
  documents: (id) => db.Documents.findByPk(id, { attributes: ["created_by"] }),
  reports: (id) => db.Reports.findByPk(id, { attributes: ["created_by"] }),
  membership_reports: (id) => db.MembershipReports.findByPk(id, { attributes: ["user_id"] }),
  tickets: async (id) => {
    const row = await db.Tickets.findByPk(id, { attributes: ["created_by", "assigned_to"] });
    return row ? [row.created_by, row.assigned_to].filter(Boolean) : [];
  },
  todos: (id) => db.UserTasks.findByPk(id, { attributes: ["user_id"] }),
  communications: (id) => db.Communications.findByPk(id, { attributes: ["created_by"] }),
  assets: (id) => db.Assets.findByPk(id, { attributes: ["user_id"] }),
  attendance: (id) => db.Attendance.findByPk(id, { attributes: ["created_by"] }),
  permissions: (id) => db.Communications.findByPk(id, { attributes: ["created_by", "communication_type"] }),
  users: (id) => db.Users.findByPk(id, { attributes: ["id"] }),
  inventory: (id) => db.InventoryItems.findByPk(id, { attributes: ["created_by"] }),
  members: () => null,
};

export function canUseEdComments(role) {
  return isExecutiveRole(role) || isExactHr(role);
}

export async function getStakeholderIds(module, recordId) {
  const handler = STAKEHOLDER_QUERIES[module];
  if (!handler) return [];
  const result = await handler(recordId);
  if (Array.isArray(result)) return result.filter(Boolean);
  if (!result) return [];
  const ids = [];
  if (result.prepared_by) ids.push(result.prepared_by);
  if (result.user_id) ids.push(result.user_id);
  if (result.created_by) ids.push(result.created_by);
  if (result.id) ids.push(result.id);
  return [...new Set(ids.filter(Boolean))];
}

export async function getModuleRecordLabel(module, recordId) {
  const id = Number(recordId);
  switch (module) {
    case "requisitions":
      return `Requisition #${id}`;
    case "special_requisitions": {
      const row = await db.SpecialRequisitions.findByPk(id, { attributes: ["title"] });
      return row?.title ? `Vehicle Utilization: ${row.title}` : `Vehicle Utilization #${id}`;
    }
    case "leave_requests":
      return `Leave Request #${id}`;
    case "leave_schedule":
      return `Leave Schedule #${id}`;
    case "missions":
      return `Mission #${id}`;
    case "documents": {
      const row = await db.Documents.findByPk(id, { attributes: ["title"] });
      return row?.title ? `Document: ${row.title}` : `Document #${id}`;
    }
    case "reports": {
      const row = await db.Reports.findByPk(id, { attributes: ["title"] });
      return row?.title ? `Report: ${row.title}` : `Report #${id}`;
    }
    case "membership_reports": {
      const row = await db.MembershipReports.findByPk(id, { attributes: ["title"] });
      return row?.title ? `Membership Report: ${row.title}` : `Membership Report #${id}`;
    }
    case "tickets": {
      const row = await db.Tickets.findByPk(id, { attributes: ["title"] });
      return row?.title ? `Ticket: ${row.title}` : `Ticket #${id}`;
    }
    case "todos": {
      const row = await db.UserTasks.findByPk(id, { attributes: ["title"] });
      return row?.title ? `Todo: ${row.title}` : `Todo #${id}`;
    }
    case "communications":
    case "permissions": {
      const row = await db.Communications.findByPk(id, { attributes: ["title", "communication_type"] });
      const prefix = row?.communication_type === "permission" ? "Permission" : "Communication";
      return row?.title ? `${prefix}: ${row.title}` : `${prefix} #${id}`;
    }
    case "assets": {
      const row = await db.Assets.findByPk(id, { attributes: ["name"] });
      return row?.name ? `Asset: ${row.name}` : `Asset #${id}`;
    }
    case "attendance": {
      const row = await db.Attendance.findByPk(id, { attributes: ["title"] });
      return row?.title ? `Attendance: ${row.title}` : `Attendance #${id}`;
    }
    case "users": {
      const row = await db.Users.findByPk(id, { attributes: ["names"] });
      return row?.names ? `User: ${row.names}` : `User #${id}`;
    }
    case "inventory": {
      const row = await db.InventoryItems.findByPk(id, { attributes: ["name"] });
      return row?.name ? `Inventory: ${row.name}` : `Inventory #${id}`;
    }
    case "members": {
      const row = await db.Members.findByPk(id, { attributes: ["company_name", "owner_name"] });
      const name = row?.company_name || row?.owner_name;
      return name ? `Member: ${name}` : `Member #${id}`;
    }
    default:
      return `${module.replace(/_/g, " ")} #${id}`;
  }
}

export async function getEdUserIds() {
  const rows = await db.Users.findAll({
    where: {
      role: { [Op.in]: ["ED", "ed", "Chairman", "chairman"] },
      active: 1,
      deleted: { [Op.or]: [null, "0", 0, false] },
    },
    attributes: ["id"],
  });
  return rows.map((r) => r.id);
}

export async function buildNotifyCandidates(module, recordId, currentUserId, parentAuthorId = null) {
  const stakeholderIds = await getStakeholderIds(module, recordId);
  const hrUsers = await db.Users.findAll({
    where: {
      role: { [Op.in]: ["HR", "hr"] },
      active: 1,
      deleted: { [Op.or]: [null, "0", 0, false] },
    },
    attributes: ["id", "names", "email", "role"],
  });
  const stakeholderUsers = stakeholderIds.length
    ? await db.Users.findAll({
        where: { id: stakeholderIds },
        attributes: ["id", "names", "email", "role"],
      })
    : [];

  const map = new Map();
  const addUser = (user, involvement, suggested = false) => {
    if (!user || user.id === currentUserId) return;
    if (!map.has(user.id)) {
      map.set(user.id, {
        id: user.id,
        names: user.names,
        email: user.email,
        role: user.role,
        involvement,
        suggested,
      });
    }
  };

  stakeholderUsers.forEach((u) => addUser(u, "Record stakeholder", true));
  hrUsers.forEach((u) => addUser(u, "HR", stakeholderIds.includes(u.id)));
  if (parentAuthorId) {
    const parent = await db.Users.findByPk(parentAuthorId, { attributes: ["id", "names", "email", "role"] });
    addUser(parent, "Note author", true);
  }

  return Array.from(map.values());
}

export async function searchNotifyUsers(query, currentUserId) {
  const q = String(query || "").trim();
  if (!q) return [];
  const rows = await db.Users.findAll({
    where: {
      active: 1,
      deleted: { [Op.or]: [null, "0", 0, false] },
      [Op.or]: [
        { names: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
        { role: { [Op.iLike]: `%${q}%` } },
      ],
    },
    attributes: ["id", "names", "email", "role"],
    limit: 20,
    order: [["names", "ASC"]],
  });
  return rows.filter((u) => u.id !== currentUserId).map((u) => ({
    id: u.id,
    names: u.names,
    email: u.email,
    role: u.role,
  }));
}

export function edConsoleLink(module, recordId) {
  return `/dashboard/ed-full-access?tab=${encodeURIComponent(module)}&comment_record=${recordId}`;
}

export async function notifySelectedUsers({
  senderId,
  senderName,
  module,
  recordId,
  message,
  notifyIds,
  notifyTitle,
  parentId,
  commentId,
}) {
  const link = edConsoleLink(module, recordId);
  const recordLabel = await getModuleRecordLabel(module, recordId);
  const notified = [];
  await Promise.all(
    notifyIds.map(async (receiverId) => {
      if (receiverId === senderId) return;
      await createNotification({
      whatsapp: true,
        receiverId,
        type: parentId ? "ed_module_reply" : "ed_module_comment",
        title: notifyTitle || "ED note",
        message: message.slice(0, 200),
        link,
        emailPayload: buildEmailPayload("ed_note", {
          id: commentId || recordId,
          title: notifyTitle || recordLabel,
          module,
          message,
        }, {
          intro: parentId
            ? `${senderName} replied to an ED note on ${recordLabel}.`
            : `${senderName} left an ED note on ${recordLabel}.`,
          actor: { names: senderName },
          note: message,
          actionRequired: parentId ? undefined : "Please review this note and respond if you are a recipient.",
        }),
      });
      if (!parentId && commentId) {
        await db.EdCommentRecipients.findOrCreate({
          where: { comment_id: commentId, user_id: receiverId },
          defaults: {
            module_type: module,
            record_id: recordId,
          },
        });
      }
      notified.push(receiverId);
    })
  );
  return notified;
}
