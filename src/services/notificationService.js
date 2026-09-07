import db from "../database/models/index.js";
import Email from "../utils/mailer.js";
import { toPlainText } from "../utils/plainText.js";
import { normalizeNotificationPriority, NOTIFICATION_PRIORITIES } from "../utils/notificationPriority.js";
import {
  buildWhatsAppText,
  normalizeRwandaPhone,
  sendWhatsAppMessage,
  whatsappConfigured,
} from "../utils/whatsapp.js";

function frontendBase() {
  return String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

/** Public URL for WhatsApp links — must be a real domain (not localhost) to be clickable. */
function whatsappPublicBase() {
  const explicit = process.env.WHATSAPP_PUBLIC_URL || process.env.PUBLIC_APP_URL;
  if (explicit) return String(explicit).replace(/\/$/, "");

  const frontend = frontendBase();
  if (!/localhost|127\.0\.0\.1|\[::1\]/i.test(frontend)) return frontend;

  return "https://rwvca.org.rw";
}

export function absoluteWhatsAppUrl(link) {
  const path = dashboardLink(link);
  if (!path) return whatsappPublicBase();
  if (/^https?:\/\//i.test(path)) return path.replace(/^http:\/\//i, "https://");
  return `${whatsappPublicBase()}${path}`;
}

export function dashboardLink(link) {
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  if (link.startsWith("/dashboard")) return link;
  if (link.startsWith("/")) return `/dashboard${link}`;
  return `/dashboard/${link}`;
}

export function absoluteDashboardUrl(link) {
  const path = dashboardLink(link);
  if (!path) return frontendBase();
  if (/^https?:\/\//i.test(path)) return path;
  return `${frontendBase()}${path}`;
}

/**
 * Central notification types used across controllers.
 * Controllers should call createNotification() with these type keys.
 */
export const NOTIFICATION_TYPES = {
  USER_CREATED: "user_created",
  USER_UPDATED: "user_updated",
  ACCOUNT_DEACTIVATED: "account_deactivated",
  ACCOUNT_RESTORED: "account_restored",
  SIGNATURE_APPROVED: "signature_approved",
  SIGNATURE_REJECTED: "signature_rejected",
  LEAVE_SUBMITTED: "leave_submitted",
  LEAVE_APPROVED: "leave_approved",
  LEAVE_REJECTED: "leave_rejected",
  LEAVE_REVERTED: "leave_reverted",
  MISSION_SUBMITTED: "mission_submitted",
  MISSION_APPROVED: "mission_approved",
  MISSION_REJECTED: "mission_rejected",
  REQUISITION_SUBMITTED: "requisition_submitted",
  REQUISITION_UPDATED: "requisition_updated",
  SPECIAL_REQUISITION: "special_requisition",
  TICKET_CREATED: "ticket_created",
  TICKET_UPDATED: "ticket_updated",
  TICKET_REPLY: "ticket_reply",
  DOCUMENT_SHARED: "document_shared",
  DOCUMENT_COMMENT: "document_comment",
  COMMUNICATION: "communication",
  REPORT: "report",
  TODO_SHARED: "todo_shared",
  ASSET: "asset",
  MEMBERSHIP_REPORT: "membership_report",
  ED_NOTE: "ed_note",
  GENERIC: "notification",
};

export { NOTIFICATION_PRIORITIES, normalizeNotificationPriority };

export async function sendStaffEmail(user, { subject, message, link, heading, password, emailPayload }) {
  if (!user?.email) return;
  try {
    const mailer = new Email(
      { email: user.email, names: user.names, password: password || user.password },
      { message },
      password ? `${frontendBase()}/login` : absoluteDashboardUrl(link)
    );
    if (password) {
      await mailer.sendAccountAdded();
      return;
    }
    mailer.message = message;
    if (emailPayload) mailer.setEmailPayload(emailPayload);
    await mailer.send("Notification", subject, heading || subject);
  } catch (error) {
    console.error("Staff email failed:", error.message);
  }
}

export async function sendStaffWhatsApp(user, { title, message, link, emailPayload }) {
  if (!whatsappConfigured()) return;
  const phone = user?.phone || user?.other_phone;
  if (!phone) return;

  try {
    const text = buildWhatsAppText({
      title,
      message,
      url: absoluteWhatsAppUrl(link),
      userName: user?.names,
      emailPayload,
    });
    await sendWhatsAppMessage({ to: phone, text });
  } catch (error) {
    console.error(
      "Staff WhatsApp failed:",
      error.response?.data || error.message
    );
  }
}

/**
 * Send in-app + email + WhatsApp notifications through one call.
 */
export async function notifyStaff(user, {
  subject,
  message,
  link,
  heading,
  password,
  emailPayload,
  email = true,
  whatsapp,
} = {}) {
  if (!user) return;

  const sendEmail = email !== false;
  const sendWhatsApp = whatsapp !== false;

  const tasks = [];
  if (sendEmail) {
    tasks.push(sendStaffEmail(user, { subject, message, link, heading, password, emailPayload }));
  }
  if (sendWhatsApp && !password) {
    tasks.push(sendStaffWhatsApp(user, {
      title: heading || subject,
      message,
      link,
      emailPayload,
    }));
  }

  await Promise.allSettled(tasks);
}

/**
 * Central entry point for all staff notifications.
 * Creates DB row, sends email and WhatsApp when enabled.
 */
export async function createNotification({
  receiverId,
  type,
  title,
  message,
  link = null,
  userType = "staff",
  email = true,
  whatsapp = true,
  emailPayload = null,
  priority = "middle",
}) {
  const cleanTitle = toPlainText(title) || null;
  const cleanMessage = toPlainText(message);
  if (!receiverId || !cleanMessage) return null;

  const storedLink = dashboardLink(link);
  const storedPriority = normalizeNotificationPriority(priority);
  const priorityLabel = storedPriority.charAt(0).toUpperCase() + storedPriority.slice(1);
  const subjectBase = cleanTitle || "RWVCA Notification";
  const subject = storedPriority === "middle" || storedPriority === "low"
    ? subjectBase
    : `[${priorityLabel}] ${subjectBase}`;
  const heading = subjectBase;

  try {
    const row = await db.Notifications.create({
      receiver_id: receiverId,
      type: type || NOTIFICATION_TYPES.GENERIC,
      title: cleanTitle,
      message: cleanMessage,
      link: storedLink,
      status: "unread",
      user_type: userType,
      priority: storedPriority,
    });

    if (email !== false || whatsapp !== false) {
      const user = await db.Users.findByPk(receiverId, {
        attributes: ["id", "names", "email", "phone", "other_phone"],
      });
      notifyStaff(user, {
        subject,
        message: cleanMessage,
        link: storedLink,
        heading,
        emailPayload,
        email,
        whatsapp,
      }).catch(() => {});
    }

    return row;
  } catch (error) {
    console.error("Failed to create notification:", error.message);
    return null;
  }
}

export { normalizeRwandaPhone, whatsappConfigured };
