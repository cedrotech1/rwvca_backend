import path from "path";
import fs from "fs";

/**
 * Normalize multer/disk paths to a portable relative path: uploads/...
 */
export const toRelativeUploadPath = (storedPath) => {
  if (!storedPath) return null;
  const normalized = String(storedPath).replace(/\\/g, "/");
  const idx = normalized.toLowerCase().indexOf("uploads/");
  if (idx >= 0) {
    return normalized.slice(idx);
  }
  if (normalized.startsWith("/")) {
    return normalized.replace(/^\/+/, "");
  }
  return normalized;
};

/**
 * Resolve a stored filePath to an absolute path that exists on disk.
 */
export const resolveUploadFilePath = (storedPath) => {
  if (!storedPath) return null;

  const relative = toRelativeUploadPath(storedPath);
  const candidates = [];

  if (path.isAbsolute(storedPath)) {
    candidates.push(storedPath);
  }
  if (relative) {
    candidates.push(path.join(process.cwd(), relative));
    candidates.push(path.resolve(relative));
  }

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // try next
    }
  }

  return relative ? path.join(process.cwd(), relative) : storedPath;
};

/**
 * Public URL path for authenticated /uploads serving.
 */
export const toPublicUploadUrl = (storedPath) => {
  const relative = toRelativeUploadPath(storedPath);
  if (!relative) return null;
  return `/${relative.replace(/^\/+/, "")}`;
};
