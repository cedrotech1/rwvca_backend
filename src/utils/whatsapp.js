import axios from "axios";
import { toPlainText } from "./plainText.js";

const DEFAULT_API_URL = "https://wasenderapi.com/api/send-message";

export function whatsappConfigured() {
  return (
    process.env.WHATSAPP_ENABLED !== "false"
    && Boolean(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN)
  );
}

/**
 * Normalize phone numbers to E.164 for Rwanda (+250...).
 */
export function normalizeRwandaPhone(phone) {
  if (!phone) return null;

  let value = String(phone).trim().replace(/\s+/g, "");
  if (!value) return null;

  if (value.startsWith("+")) {
    const digits = value.slice(1).replace(/\D/g, "");
    if (!digits) return null;
    if (digits.startsWith("250")) return `+${digits}`;
    if (/^0?7\d{8}$/.test(digits) || /^7\d{8}$/.test(digits)) {
      return `+250${digits.replace(/^0/, "")}`;
    }
    return `+${digits}`;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("250")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+250${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `+250${digits}`;

  return `+250${digits.replace(/^0+/, "")}`;
}

function truncate(text, max = 180) {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trim()}...`;
}

/** Ensure URL is https and has no wrapping/formatting that breaks WhatsApp link detection. */
export function normalizeWhatsAppUrl(url) {
  if (!url) return "";
  let value = String(url).trim();
  if (!/^https?:\/\//i.test(value)) return value;
  value = value.replace(/^http:\/\//i, "https://");
  // Strip trailing punctuation WhatsApp might attach to the link
  value = value.replace(/[.,;:!?)]+$/, "");
  return value;
}

/**
 * Short WhatsApp alert with a standalone clickable URL on its own line.
 */
export function buildWhatsAppText({
  title,
  message,
  url,
  userName,
  emailPayload,
}) {
  const payload = emailPayload || {};
  const summary = truncate(toPlainText(payload.intro || message || title), 180);
  const link = normalizeWhatsAppUrl(url);
  const lines = [];

  if (userName) lines.push(`Hi ${toPlainText(userName)},`);
  if (title) lines.push(`*${truncate(toPlainText(title), 80)}*`);
  if (summary) lines.push(summary);

  if (link) {
    lines.push("Open:");
    lines.push(link);
  }

  lines.push("RWVCA MIS");

  return lines.filter(Boolean).join("\n");
}

export async function sendWhatsAppMessage({ to, text }) {
  if (!whatsappConfigured()) {
    return { skipped: true, reason: "WhatsApp not configured" };
  }

  const phone = normalizeRwandaPhone(to);
  if (!phone) {
    return { skipped: true, reason: "Invalid phone number" };
  }

  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN;
  const apiUrl = process.env.WHATSAPP_API_URL || DEFAULT_API_URL;

  const response = await axios.post(
    apiUrl,
    { to: phone, text },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: Number(process.env.WHATSAPP_TIMEOUT_MS || 15000),
    }
  );

  return { success: true, phone, data: response.data };
}
