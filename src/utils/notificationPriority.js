export const NOTIFICATION_PRIORITIES = ["urgent", "high", "middle", "low"];

export const NOTIFICATION_PRIORITY_RANK = {
  urgent: 0,
  high: 1,
  middle: 2,
  low: 3,
};

const ALIASES = {
  urgent: "urgent",
  high: "high",
  middle: "middle",
  medium: "middle",
  normal: "middle",
  low: "low",
};

export function normalizeNotificationPriority(value, { required = false, fallback = "middle" } = {}) {
  const key = String(value || "").trim().toLowerCase();
  const mapped = ALIASES[key] || null;
  if (mapped) return mapped;
  if (required) return null;
  return ALIASES[String(fallback).toLowerCase()] || "middle";
}

export function requireNotificationPriority(body = {}) {
  return normalizeNotificationPriority(body.priority || body.notification_priority || body.send_as, {
    required: true,
  });
}
