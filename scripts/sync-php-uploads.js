/**
 * Clean BACKEND/uploads, then copy files from the PHP platform:
 *   - rwvca-platform/uploads/*          → uploads/<same folder>
 *   - rwvca-platform/dashboard1/uploads/* → uploads/<same folder>
 *   - loose files in dashboard1/uploads → uploads/documents
 *   - dashboard1/upload (singular)      → profiles / signatures
 *
 * Usage:
 *   set PHP_PROJECT_ROOT=C:\Users\...\rwvca-platform
 *   npm run sync:uploads
 */
const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..", "uploads");
const phpRoot = path.resolve(
  process.env.PHP_PROJECT_ROOT ||
    path.join("C:", "Users", "HUAWEI", "Desktop", "rwvca-platform")
);

const SKIP_NAMES = new Set([".htaccess", ".gitkeep", ".DS_Store", "Thumbs.db"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) {
    ensureDir(dir);
    return 0;
  }
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === ".gitkeep") continue;
    fs.rmSync(full, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

/** Copy directory tree; returns { files, skipped } */
function copyDir(src, dest, { overwrite = true } = {}) {
  if (!fs.existsSync(src)) return { files: 0, skipped: 0 };
  ensureDir(dest);
  let files = 0;
  let skipped = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name) || entry.name.startsWith(".")) {
      skipped += 1;
      continue;
    }
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const nested = copyDir(from, to, { overwrite });
      files += nested.files;
      skipped += nested.skipped;
    } else if (entry.isFile()) {
      if (!overwrite && fs.existsSync(to)) {
        skipped += 1;
        continue;
      }
      copyFile(from, to);
      files += 1;
    }
  }
  return { files, skipped };
}

/** Copy only immediate files (not subdirs) into dest */
function copyLooseFiles(src, dest) {
  if (!fs.existsSync(src)) return 0;
  ensureDir(dest);
  let files = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (SKIP_NAMES.has(entry.name) || entry.name.startsWith(".")) continue;
    copyFile(path.join(src, entry.name), path.join(dest, entry.name));
    files += 1;
  }
  return files;
}

function copyNamedSubfolders(srcUploads, destRoot) {
  const summary = {};
  if (!fs.existsSync(srcUploads)) return summary;
  for (const entry of fs.readdirSync(srcUploads, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (SKIP_NAMES.has(entry.name) || entry.name.startsWith(".")) continue;
    const result = copyDir(path.join(srcUploads, entry.name), path.join(destRoot, entry.name));
    summary[entry.name] = result.files;
  }
  return summary;
}

if (!fs.existsSync(phpRoot)) {
  console.error(`PHP project not found: ${phpRoot}`);
  console.error("Set PHP_PROJECT_ROOT to your rwvca-platform folder.");
  process.exit(1);
}

console.log("Cleaning backend uploads…");
const removed = cleanDir(backendRoot);
console.log(`  removed ${removed} entries from ${backendRoot}`);

const publicUploads = path.join(phpRoot, "uploads");
const dashUploads = path.join(phpRoot, "dashboard1", "uploads");
const dashUploadSingular = path.join(phpRoot, "dashboard1", "upload");

console.log("\nCopying public website uploads…");
const publicSummary = copyNamedSubfolders(publicUploads, backendRoot);
for (const [folder, count] of Object.entries(publicSummary)) {
  console.log(`  uploads/${folder}: ${count} files`);
}

console.log("\nCopying dashboard1/uploads folders…");
const dashSummary = copyNamedSubfolders(dashUploads, backendRoot);
for (const [folder, count] of Object.entries(dashSummary)) {
  const prev = publicSummary[folder] || 0;
  console.log(`  uploads/${folder}: +${count} files (now from dashboard; public had ${prev})`);
}

console.log("\nCopying loose dashboard1/uploads files → documents…");
const looseDocs = copyLooseFiles(dashUploads, path.join(backendRoot, "documents"));
console.log(`  uploads/documents: +${looseDocs} files`);

if (fs.existsSync(dashUploadSingular)) {
  console.log("\nCopying dashboard1/upload (singular)…");
  const sigSrc = path.join(dashUploadSingular, "signatures");
  if (fs.existsSync(sigSrc)) {
    const sig = copyDir(sigSrc, path.join(backendRoot, "signatures"));
    console.log(`  uploads/signatures: +${sig.files} files`);
  }
  const profiles = copyLooseFiles(dashUploadSingular, path.join(backendRoot, "profiles"));
  console.log(`  uploads/profiles: +${profiles} files`);
}

// Keep .gitkeep
fs.writeFileSync(path.join(backendRoot, ".gitkeep"), "");

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(full);
    else if (entry.isFile() && entry.name !== ".gitkeep") n += 1;
  }
  return n;
}

console.log("\nDone.");
console.log(`  source: ${phpRoot}`);
console.log(`  dest:   ${backendRoot}`);
console.log(`  total files: ${countFiles(backendRoot)}`);
