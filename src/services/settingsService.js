import db from "../database/models/index.js";

const Settings = db.Settings;

export async function getSettings() {
  const row = await Settings.findByPk(1);
  if (!row) return null;
  const data = row.toJSON();
  delete data.export_db_password;
  return data;
}

export async function getRawSettings() {
  return Settings.findByPk(1);
}

export async function isEmailNotificationEnabled() {
  const settings = await Settings.findByPk(1);
  if (!settings) return true;
  return String(settings.send_email_notification || "yes").toLowerCase() === "yes";
}
