const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { scanFilePathForThreats, isAllowedUpload } = require("./malwareGuard.js");

const MAX_BYTES = 10 * 1024 * 1024;

const PUBLIC_FOLDERS = new Set([
  "ads",
  "gallery",
  "events",
  "programs",
  "partners",
  "products",
  "platforms",
  "logo",
  "profiles",
  "team",
  "organization",
]);

const PRIVATE_FOLDERS = new Set([
  "documents",
  "signatures",
  "communications",
  "tickets",
  "leave_attachments",
  "leave_letters",
  "reports",
  "requisitions",
  "procurement",
  "tmp",
]);

function backendUploadsRoot() {
  return path.resolve(process.cwd(), "uploads");
}

function phpProjectRoot() {
  return path.resolve(process.env.PHP_PROJECT_ROOT || path.join(process.cwd(), "..", "rwvca-platform-php"));
}

function normalizeStoredPath(storedPath) {
  if (!storedPath) return null;
  let value = String(storedPath).replace(/\\/g, "/").trim();
  if (!value || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value || null;
  }
  value = value.replace(/^\/+/, "");
  const idx = value.toLowerCase().indexOf("uploads/");
  if (idx >= 0) value = value.slice(idx);
  return value;
}

function folderOf(storedPath) {
  const relative = normalizeStoredPath(storedPath);
  if (!relative) return null;
  const withoutUploads = relative.replace(/^uploads\//i, "");
  return withoutUploads.split("/")[0] || null;
}

function isPublicStoredPath(storedPath) {
  const folder = folderOf(storedPath);
  if (!folder) return false;
  if (PRIVATE_FOLDERS.has(folder)) return false;
  return PUBLIC_FOLDERS.has(folder);
}

function resolveUploadFilePath(storedPath) {
  const relative = normalizeStoredPath(storedPath);
  if (!relative || relative.startsWith("http")) return null;

  const withoutUploads = relative.replace(/^uploads\//i, "");
  const backendRoot = backendUploadsRoot();
  const phpRoot = phpProjectRoot();

  const candidates = [
    path.join(backendRoot, withoutUploads),
    path.join(backendRoot, relative),
    path.join(phpRoot, "uploads", withoutUploads),
    path.join(phpRoot, relative),
    path.join(phpRoot, "dashboard1", relative),
    path.join(phpRoot, "dashboard1", "uploads", withoutUploads),
    path.join(phpRoot, "dashboard1", withoutUploads),
  ];

  for (const candidate of candidates) {
    try {
      const resolved = path.resolve(candidate);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return resolved;
      }
    } catch {
      // try next
    }
  }

  return path.join(backendRoot, withoutUploads);
}

function toPublicUploadUrl(storedPath) {
  const relative = normalizeStoredPath(storedPath);
  if (!relative) return null;
  if (relative.startsWith("http://") || relative.startsWith("https://")) return relative;
  const withoutUploads = relative.replace(/^uploads\//i, "");
  return `/uploads/${withoutUploads}`;
}

function safeBaseName(originalName) {
  const base = path.basename(String(originalName || "file")).replace(/[^\w.\-() ]+/g, "_");
  return base || "file";
}

function uniqueName(originalName, prefix) {
  const ext = path.extname(originalName || "").toLowerCase();
  const stem = path.basename(originalName || "file", ext).replace(/[^\w.\-]+/g, "_").slice(0, 40);
  const id = `${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
  if (prefix) return `${prefix}_${id}${ext}`;
  return `${id}_${stem}${ext}`;
}

function takeUploadedFile(req, names = ["file", "image", "document_file", "attachment", "signature"]) {
  if (!req?.files) return null;
  const explicit = Array.isArray(names) && names.length;
  const list = explicit ? names : ["file", "image", "document_file", "attachment", "signature"];
  for (const name of list) {
    const value = req.files[name];
    if (!value) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  if (explicit) return null;
  const keys = Object.keys(req.files);
  if (!keys.length) return null;
  const first = req.files[keys[0]];
  return Array.isArray(first) ? first[0] : first;
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function saveBufferToFolder({ buffer, originalName, mimeType, folder, prefix }) {
  if (!buffer || !buffer.length) {
    throw httpError("Empty file");
  }
  if (buffer.length > MAX_BYTES) {
    throw httpError("File size too large. Maximum 10MB.");
  }
  if (!isAllowedUpload(originalName, mimeType)) {
    throw httpError("This file type is not allowed.");
  }

  const destFolder = String(folder || "files").replace(/[^a-z0-9_\-]/gi, "");
  const filename = uniqueName(safeBaseName(originalName), prefix);
  const absDir = path.join(backendUploadsRoot(), destFolder);
  fs.mkdirSync(absDir, { recursive: true });
  const absPath = path.join(absDir, filename);
  fs.writeFileSync(absPath, buffer);

  const scan = scanFilePathForThreats(absPath, fs);
  if (!scan.safe) {
    fs.unlinkSync(absPath);
    throw httpError("File rejected by security scan");
  }

  const relative = `${destFolder}/${filename}`;
  return {
    filename,
    relativePath: relative,
    dbPath: destFolder === "documents" ? `uploads/documents/${filename}` : relative,
    publicUrl: `/uploads/${relative}`,
    mimeType: mimeType || null,
    size: buffer.length,
    originalName: safeBaseName(originalName),
  };
}

function readUploadedFileBuffer(uploaded) {
  if (!uploaded) return null;
  // express-fileupload with useTempFiles:true leaves file.data as an empty Buffer.
  if (uploaded.tempFilePath && fs.existsSync(uploaded.tempFilePath)) {
    const fromDisk = fs.readFileSync(uploaded.tempFilePath);
    if (fromDisk && fromDisk.length) return fromDisk;
  }
  if (uploaded.data && uploaded.data.length) return uploaded.data;
  return null;
}

function cleanupTempFile(uploaded) {
  if (uploaded?.tempFilePath && fs.existsSync(uploaded.tempFilePath)) {
    try { fs.unlinkSync(uploaded.tempFilePath); } catch { /* ignore */ }
  }
}

function collectUploadedFiles(req, fieldNames = ["file", "image", "document_file", "attachment", "signature", "attachments"]) {
  if (!req?.files) return [];
  const names = [...new Set([
    ...(fieldNames || []),
    ...(fieldNames || []).map((name) => `${name}[]`),
  ])];
  const out = [];
  const seen = new Set();
  names.forEach((name) => {
    const value = req.files[name];
    if (!value) return;
    (Array.isArray(value) ? value : [value]).forEach((file) => {
      const key = file.tempFilePath || `${file.name}:${file.size}:${file.md5 || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(file);
    });
  });
  return out;
}

function saveOneUploadedFile(uploaded, folder, prefix) {
  const buffer = readUploadedFileBuffer(uploaded);
  if (!buffer || !buffer.length) {
    cleanupTempFile(uploaded);
    return null;
  }
  const saved = saveBufferToFolder({
    buffer,
    originalName: uploaded.name,
    mimeType: uploaded.mimetype,
    folder,
    prefix,
  });
  cleanupTempFile(uploaded);
  return saved;
}

function saveRequestFile(req, folder, options = {}) {
  const uploaded = takeUploadedFile(req, options.fieldNames);
  if (!uploaded) return null;
  return saveOneUploadedFile(uploaded, folder, options.prefix);
}

function saveRequestFiles(req, folder, options = {}) {
  const files = collectUploadedFiles(req, options.fieldNames || ["attachments", "file", "attachment"]);
  return files
    .map((file, index) => saveOneUploadedFile(
      file,
      folder,
      options.prefix ? `${options.prefix}_${index}` : `file_${index}`
    ))
    .filter(Boolean);
}

function ensureUploadFolders() {
  const root = backendUploadsRoot();
  [...PUBLIC_FOLDERS, ...PRIVATE_FOLDERS, "documents"].forEach((folder) => {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  });
}

module.exports = {
  PUBLIC_FOLDERS,
  PRIVATE_FOLDERS,
  backendUploadsRoot,
  phpProjectRoot,
  normalizeStoredPath,
  isPublicStoredPath,
  resolveUploadFilePath,
  toPublicUploadUrl,
  takeUploadedFile,
  readUploadedFileBuffer,
  saveBufferToFolder,
  saveRequestFile,
  saveRequestFiles,
  ensureUploadFolders,
};
