const ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Strip Word/Outlook paste junk and HTML so notifications stay plain text.
 */
function toPlainText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return String(value);

  return value
    .replace(/<!--\s*StartFragment\s*-->/gi, "")
    .replace(/<!--\s*EndFragment\s*-->/gi, "")
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?(html|head|body|meta|link|style|xml)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
      const key = String(entity).toLowerCase();
      if (ENTITY_MAP[key]) return ENTITY_MAP[key];
      if (key.startsWith("#x")) {
        const code = parseInt(key.slice(2), 16);
        return Number.isNaN(code) ? "" : String.fromCharCode(code);
      }
      if (key.startsWith("#")) {
        const code = parseInt(key.slice(1), 10);
        return Number.isNaN(code) ? "" : String.fromCharCode(code);
      }
      return "";
    })
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizeNotificationRow(row) {
  if (!row) return row;
  const data = typeof row.toJSON === "function" ? row.toJSON() : { ...row };
  if (data.title != null) data.title = toPlainText(data.title);
  if (data.message != null) data.message = toPlainText(data.message);
  return data;
}

module.exports = {
  toPlainText,
  sanitizeNotificationRow,
};
