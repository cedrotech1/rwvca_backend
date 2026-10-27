import fs from "fs";
import fileStorage from "../utils/fileStorage.js";

const { resolveUploadFilePath, backendUploadsRoot } = fileStorage;

function isRemoteOrEmpty(storedPath) {
  const value = String(storedPath || "").trim();
  if (!value) return true;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  );
}

export function fileExistsOnDisk(storedPath) {
  if (isRemoteOrEmpty(storedPath)) return false;
  try {
    const abs = resolveUploadFilePath(storedPath);
    return Boolean(abs && fs.existsSync(abs) && fs.statSync(abs).isFile());
  } catch {
    return false;
  }
}

async function collectSource(label, rows, mapRow) {
  const items = [];
  let present = 0;
  let missing = 0;
  let skipped = 0;

  for (const row of rows) {
    const mapped = mapRow(row);
    if (!mapped || isRemoteOrEmpty(mapped.path)) {
      skipped += 1;
      continue;
    }
    const exists = fileExistsOnDisk(mapped.path);
    if (exists) {
      present += 1;
    } else {
      missing += 1;
      items.push({
        source: label,
        id: mapped.id,
        title: mapped.title || null,
        path: mapped.path,
      });
    }
  }

  return {
    source: label,
    total: present + missing,
    present,
    missing,
    skipped,
    missing_items: items,
  };
}

/**
 * Compare DB-referenced upload paths against files on disk under uploads/.
 */
export async function getUploadsIntegrityReport(db) {
  const sources = [];

  if (db.Documents) {
    const rows = await db.Documents.findAll({
      attributes: ["id", "title", "file_path", "created_at"],
      order: [["id", "ASC"]],
      raw: true,
    });
    sources.push(
      await collectSource("documents", rows, (row) => ({
        id: row.id,
        title: row.title,
        path: row.file_path,
      }))
    );
  }

  if (db.ReportAttachments) {
    const rows = await db.ReportAttachments.findAll({
      attributes: ["id", "report_id", "file_path", "file_name"],
      raw: true,
    });
    sources.push(
      await collectSource("report_attachments", rows, (row) => ({
        id: row.id,
        title: row.file_name || `report #${row.report_id}`,
        path: row.file_path,
      }))
    );
  }

  if (db.ProcurementDocuments) {
    const rows = await db.ProcurementDocuments.findAll({
      attributes: ["id", "procurement_id", "file_path", "file_name"],
      raw: true,
    });
    sources.push(
      await collectSource("procurement_documents", rows, (row) => ({
        id: row.id,
        title: row.file_name || `procurement #${row.procurement_id}`,
        path: row.file_path,
      }))
    );
  }

  if (db.CommunicationAttachments) {
    const rows = await db.CommunicationAttachments.findAll({
      attributes: ["id", "communication_id", "link", "type"],
      raw: true,
    });
    sources.push(
      await collectSource("communication_attachments", rows, (row) => ({
        id: row.id,
        title: row.type || `communication #${row.communication_id}`,
        path: row.link,
      }))
    );
  }

  if (db.Users) {
    const rows = await db.Users.findAll({
      attributes: ["id", "names", "signature_url"],
      where: { signature_url: { [db.Sequelize.Op.ne]: null } },
      raw: true,
    });
    sources.push(
      await collectSource("user_signatures", rows, (row) => ({
        id: row.id,
        title: row.names,
        path: row.signature_url,
      }))
    );
  }

  const totals = sources.reduce(
    (acc, src) => {
      acc.total += src.total;
      acc.present += src.present;
      acc.missing += src.missing;
      acc.skipped += src.skipped;
      return acc;
    },
    { total: 0, present: 0, missing: 0, skipped: 0 }
  );

  const missing_items = sources.flatMap((src) => src.missing_items);

  return {
    uploads_root: backendUploadsRoot(),
    totals: {
      ...totals,
      missing_percent: totals.total
        ? Math.round((totals.missing / totals.total) * 1000) / 10
        : 0,
    },
    by_source: sources.map(({ missing_items: _items, ...rest }) => rest),
    missing_items,
  };
}
