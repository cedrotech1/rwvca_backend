import db from "../database/models/index.js";

const Logs = db.Logs;

export async function createLog(userId, action, description) {
  try {
    await Logs.create({
      user_id: userId || null,
      action,
      description: description || null,
    });
  } catch (error) {
    console.error("Failed to write activity log:", error.message);
  }
}
