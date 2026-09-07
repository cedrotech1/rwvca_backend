/**
 * Verify every DB-referenced upload path exists under BACKEND/uploads.
 * Optionally copies missing files from PHP platform if found there.
 *
 *   node scripts/verify-uploads.js
 *   node scripts/verify-uploads.js --fix
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const fix = process.argv.includes("--fix");
const env = process.env.NODE_ENV || "development";
const dbPrefix = env === "production" ? "PRO" : env === "uat" ? "UAT" : "DEV";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const backendRoot = path.resolve(__dirname, "..", "uploads");
const phpRoot = path.resolve(
  process.env.PHP_PROJECT_ROOT ||
    path.join("C:", "Users", "HUAWEI", "Desktop", "rwvca-platform")
);

function dbConfig() {
  const host = process.env[`${dbPrefix}_DATABASE_HOST`];
  const config = {
    host,
    port: process.env[`${dbPrefix}_DATABASE_PORT`],
    user: process.env[`${dbPrefix}_DATABASE_USER`],
    password: process.env[`${dbPrefix}_DATABASE_PASSWORD`],
    database: process.env[`${dbPrefix}_DATABASE_NAME`],
  };
  if (host && !LOCAL_HOSTS.has(host)) {
    config.ssl = { require: true, rejectUnauthorized: true };
  }
  return config;
}

function normalize(storedPath) {
  if (!storedPath) return null;
  let value = String(storedPath).replace(/\\/g, "/").trim();
  if (!value || /^(https?:|data:)/i.test(value)) return null;
  value = value.replace(/^\/+/, "");
  const idx = value.toLowerCase().indexOf("uploads/");
  if (idx >= 0) value = value.slice(idx);
  return value;
}

function withoutUploadsPrefix(relative) {
  return relative.replace(/^uploads\//i, "");
}

function resolveInBackend(relative) {
  const rest = withoutUploadsPrefix(relative);
  const base = path.basename(rest);
  const candidates = [
    path.join(backendRoot, rest),
    path.join(backendRoot, relative),
    path.join(backendRoot, "documents", base),
    path.join(backendRoot, "tickets", base),
    path.join(backendRoot, "communications", base),
    path.join(backendRoot, "reports", base),
    path.join(backendRoot, "leave_letters", base),
    path.join(backendRoot, "signatures", base),
    path.join(backendRoot, "profiles", base),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function findInPhp(relative) {
  const rest = withoutUploadsPrefix(relative);
  const base = path.basename(rest);
  const candidates = [
    path.join(phpRoot, "uploads", rest),
    path.join(phpRoot, relative),
    path.join(phpRoot, "dashboard1", "uploads", rest),
    path.join(phpRoot, "dashboard1", relative),
    path.join(phpRoot, "dashboard1", "uploads", base),
    path.join(phpRoot, "dashboard1", "upload", rest),
    path.join(phpRoot, "dashboard1", "upload", base),
    path.join(phpRoot, "uploads", base),
  ];
  // also search known subfolders by basename
  const folders = [
    "documents", "reports", "communications", "tickets", "leave_letters",
    "signatures", "profiles", "ads", "events", "gallery", "logo", "platforms",
    "products", "programs", "settings",
  ];
  for (const folder of folders) {
    candidates.push(path.join(phpRoot, "uploads", folder, base));
    candidates.push(path.join(phpRoot, "dashboard1", "uploads", folder, base));
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // next
    }
  }
  return null;
}

function preferredDest(relative) {
  const rest = withoutUploadsPrefix(relative);
  if (rest.includes("/")) return path.join(backendRoot, rest);
  // bare filename historically lived in dashboard uploads root → documents
  return path.join(backendRoot, "documents", rest);
}

const QUERIES = [
  ["documents", "SELECT id, file_path AS path FROM documents WHERE file_path IS NOT NULL AND file_path <> ''"],
  ["report_attachments", "SELECT id, file_path AS path FROM report_attachments WHERE file_path IS NOT NULL AND file_path <> ''"],
  ["communications", "SELECT id, attachment_url AS path FROM communications WHERE attachment_url IS NOT NULL AND attachment_url <> ''"],
  ["communication_attachments", "SELECT id, link AS path FROM communication_attachments WHERE link IS NOT NULL AND link <> ''"],
  ["tickets", "SELECT id, attachments AS path FROM tickets WHERE attachments IS NOT NULL AND attachments <> ''"],
  ["ticket_replies", "SELECT id, attachments AS path FROM ticket_replies WHERE attachments IS NOT NULL AND attachments <> ''"],
  ["leave_requests", "SELECT id, letter_url AS path FROM leave_requests WHERE letter_url IS NOT NULL AND letter_url <> ''"],
  ["users_image", "SELECT id, image AS path FROM users WHERE image IS NOT NULL AND image <> ''"],
  ["users_signature", "SELECT id, signature_url AS path FROM users WHERE signature_url IS NOT NULL AND signature_url <> ''"],
  ["ads", "SELECT id, image AS path FROM ads WHERE image IS NOT NULL AND image <> ''"],
  ["events", "SELECT id, image AS path FROM events WHERE image IS NOT NULL AND image <> ''"],
  ["event_images", "SELECT id, url AS path FROM event_images WHERE url IS NOT NULL AND url <> ''"],
  ["gallery", "SELECT id, url AS path FROM gallery WHERE url IS NOT NULL AND url <> ''"],
  ["programs", "SELECT id, image AS path FROM programs WHERE image IS NOT NULL AND image <> ''"],
  ["program_images", "SELECT id, url AS path FROM program_images WHERE url IS NOT NULL AND url <> ''"],
  ["platforms", "SELECT id, image AS path FROM platforms WHERE image IS NOT NULL AND image <> ''"],
  ["member_products_1", "SELECT id, image1_url AS path FROM member_products WHERE image1_url IS NOT NULL AND image1_url <> ''"],
  ["member_products_2", "SELECT id, image2_url AS path FROM member_products WHERE image2_url IS NOT NULL AND image2_url <> ''"],
  ["member_products_3", "SELECT id, image3_url AS path FROM member_products WHERE image3_url IS NOT NULL AND image3_url <> ''"],
  ["partners", "SELECT id, logo_url AS path FROM partners WHERE logo_url IS NOT NULL AND logo_url <> ''"],
  ["team", "SELECT id, image AS path FROM team WHERE image IS NOT NULL AND image <> ''"],
  ["company_info", "SELECT id, logo AS path FROM company_info WHERE logo IS NOT NULL AND logo <> ''"],
  ["settings_stamp", "SELECT id, stamp_with_signature AS path FROM settings WHERE stamp_with_signature IS NOT NULL AND stamp_with_signature <> ''"],
  ["settings_sig", "SELECT id, signature_only AS path FROM settings WHERE signature_only IS NOT NULL AND signature_only <> ''"],
  ["procurement_documents", "SELECT id, file_path AS path FROM procurement_documents WHERE file_path IS NOT NULL AND file_path <> ''"],
];

async function tableExists(client, name) {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [name]
  );
  return res.rowCount > 0;
}

async function columnExists(client, table, column) {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column]
  );
  return res.rowCount > 0;
}

async function main() {
  const config = dbConfig();
  console.log(`Checking uploads against ${env} DB ${config.database} @ ${config.host}`);
  console.log(`Backend uploads: ${backendRoot}`);
  console.log(`PHP source: ${phpRoot}`);
  console.log(fix ? "Mode: verify + fix missing from PHP\n" : "Mode: verify only (pass --fix to copy missing)\n");

  const client = new Client(config);
  await client.connect();

  const missing = [];
  const found = [];
  const fixed = [];
  const skippedRemote = [];

  try {
    for (const [label, sql] of QUERIES) {
      const table = label.replace(/_image$|_signature$/, (m) => "").replace(/^users_.*/, "users");
      // parse table from SQL roughly
      const m = sql.match(/FROM\s+(\w+)/i);
      const tableName = m ? m[1] : table;
      if (!(await tableExists(client, tableName))) {
        console.log(`skip ${label} (no table)`);
        continue;
      }
      // skip if column missing
      const colMatch = sql.match(/SELECT\s+id,\s+(\w+)/i);
      if (colMatch) {
        const col = colMatch[1];
        if (col !== "value" && !(await columnExists(client, tableName, col))) {
          console.log(`skip ${label} (no column ${col})`);
          continue;
        }
      }

      let rows;
      try {
        rows = (await client.query(sql)).rows;
      } catch (err) {
        console.log(`skip ${label}: ${err.message}`);
        continue;
      }

      let ok = 0;
      let bad = 0;
      for (const row of rows) {
        const raw = row.path;
        // tickets may store "savedName|originalName" or comma-separated lists of those
        const chunks = String(raw || "")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);

        for (const chunk of chunks) {
          // Prefer the stored filename before "|"; ignore display-only original name.
          const storedPart = chunk.includes("|") ? chunk.split("|")[0].trim() : chunk;
          const relative = normalize(storedPart);
          if (!relative) {
            skippedRemote.push({ table: label, id: row.id, path: chunk });
            continue;
          }
          const existing = resolveInBackend(relative);
          if (existing) {
            ok += 1;
            found.push({ table: label, id: row.id, path: relative });
            continue;
          }

          // Also try under tickets/ folder by basename
          const ticketCandidate = path.join(backendRoot, "tickets", path.basename(relative));
          if (fs.existsSync(ticketCandidate) && fs.statSync(ticketCandidate).isFile()) {
            ok += 1;
            found.push({ table: label, id: row.id, path: relative });
            continue;
          }

          if (fix) {
            const phpFile = findInPhp(relative) || findInPhp(`tickets/${path.basename(relative)}`);
            if (phpFile) {
              const dest = path.join(backendRoot, "tickets", path.basename(relative));
              fs.mkdirSync(path.dirname(dest), { recursive: true });
              fs.copyFileSync(phpFile, dest);
              fixed.push({ table: label, id: row.id, path: relative, from: phpFile });
              ok += 1;
              continue;
            }
          }

          bad += 1;
          missing.push({ table: label, id: row.id, path: relative, raw: chunk });
        }
      }
      console.log(`${label}: ${ok} ok, ${bad} missing (rows scanned: ${rows.length})`);
    }
  } finally {
    await client.end();
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Found on disk: ${found.length + fixed.length - fixed.length}`); // messy
  console.log(`Present:       ${found.length}`);
  console.log(`Fixed now:     ${fixed.length}`);
  console.log(`Still missing: ${missing.length}`);
  console.log(`Remote/data URLs skipped: ${skippedRemote.length}`);

  if (missing.length) {
    const reportPath = path.resolve(__dirname, "missing-uploads-report.json");
    fs.writeFileSync(reportPath, JSON.stringify({ missing, fixed }, null, 2));
    console.log(`\nMissing list written to ${reportPath}`);
    console.log("First 25 missing:");
    missing.slice(0, 25).forEach((row) => {
      console.log(`  [${row.table}#${row.id}] ${row.path}`);
    });
    if (missing.length > 25) console.log(`  … and ${missing.length - 25} more`);
    process.exitCode = 1;
  } else {
    console.log("\nAll referenced upload files are present under rwvca_backend/uploads.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
