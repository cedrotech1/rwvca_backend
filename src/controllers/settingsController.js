import asyncHandler from "express-async-handler";
import { getRawSettings, getSettings } from "../services/settingsService.js";
import { ok, fail } from "../utils/apiResponse.js";
import { createLog } from "../services/logService.js";
import { isAdminRole } from "../utils/roleHelpers.js";
import Email from "../utils/mailer.js";

export const getSystemSettings = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  if (!settings) return fail(res, "Settings not found", 404);
  return ok(res, {
    ...settings,
    email_runtime: {
      env_enabled: process.env.EMAIL_ENABLED !== "false",
      smtp_configured: Email.smtpConfigured(),
      from: process.env.EMAIL_FROM || "notification@rwvca.org.rw",
      from_name: process.env.EMAIL_FROM_NAME || "RWVCA MIS",
      host: process.env.SMTP_HOST || "mail.rwvca.org.rw",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE || "tls",
    },
  });
});

export const updateSystemSettings = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const row = await getRawSettings();
  if (!row) return fail(res, "Settings not found", 404);

  const allowed = ["leave_days", "send_email_notification", "system_status", "stamp_with_signature", "signature_only"];
  const payload = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) payload[key] = req.body[key];
  });

  if (payload.system_status && !["live", "maintenance", "offline"].includes(payload.system_status)) {
    return fail(res, "Invalid system status");
  }
  if (payload.send_email_notification && !["yes", "no"].includes(payload.send_email_notification)) {
    return fail(res, "send_email_notification must be yes or no");
  }
  if (req.body.export_db_password) {
    if (String(req.body.export_db_password).length < 4) {
      return fail(res, "Export database password must be at least 4 characters");
    }
    payload.export_db_password = req.body.export_db_password;
  }

  await row.update(payload);
  Email.clearEmailSettingsCache();
  await createLog(req.user.id, "update_settings", "Updated system settings");
  return ok(res, await getSettings(), "Settings updated");
});

export const sendTestEmail = asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user.role)) return fail(res, "Access denied", 403);
  const to = String(req.body.email || req.user.email || "").trim();
  if (!to) return fail(res, "A destination email is required");
  const mailer = new Email({ email: to, names: req.user.names || "Admin" });
  mailer.setEmailPayload({
    intro: "This is a test notification from the RWVCA MIS portal. If you received this email, SMTP and the rich notification template are working correctly.",
    details: [
      { label: "Sent at", value: new Date().toLocaleString("en-GB") },
      { label: "SMTP host", value: process.env.SMTP_HOST || "mail.rwvca.org.rw" },
      { label: "From address", value: process.env.EMAIL_FROM || "notification@rwvca.org.rw" },
    ],
    actionRequired: "No action is required for this test message.",
  });
  try {
    await mailer.sendStrict(
      "Notification",
      "RWVCA MIS - Test Notification",
      "RWVCA test email",
      { forceSend: true }
    );
  } catch (error) {
    return fail(res, error.message || "Could not send test email", error.status || 400);
  }
  await createLog(req.user.id, "test_email", `Sent test email to ${to}`);
  return ok(res, { to }, `Test email sent to ${to}`);
});
