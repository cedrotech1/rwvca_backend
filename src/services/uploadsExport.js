import archiver from "archiver";
import fs from "fs";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import fileStorage from "../utils/fileStorage.js";

const { backendUploadsRoot } = fileStorage;

function stampName() {
  return `rwvca-uploads-${new Date().toISOString().slice(0, 10)}.zip`;
}

/**
 * Zip the entire uploads/ folder to a temp file, then stream it with Content-Length
 * so the admin UI can show download progress percentage.
 */
export async function sendUploadsZip(res, filename = stampName()) {
  const uploadsRoot = backendUploadsRoot();
  if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  }

  const tmpPath = path.join(
    os.tmpdir(),
    `rwvca-uploads-export-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`
  );

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(tmpPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.on("warning", (err) => {
      if (err.code !== "ENOENT") reject(err);
    });

    archive.pipe(output);
    archive.directory(uploadsRoot, "uploads");
    archive.finalize();
  });

  const stat = fs.statSync(tmpPath);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(stat.size));
  res.setHeader("Cache-Control", "no-store");

  try {
    await pipeline(fs.createReadStream(tmpPath), res);
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}
