import { ZipArchive } from "archiver";
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
 *
 * Uses archiver@8 ZipArchive (no default archiver() factory in v8).
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

  try {
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(tmpPath);
      const archive = new ZipArchive({ zlib: { level: 6 } });

      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      output.on("close", done);
      output.on("error", fail);
      archive.on("error", fail);
      archive.on("warning", (err) => {
        if (err && err.code !== "ENOENT") fail(err);
      });

      archive.pipe(output);
      archive.directory(uploadsRoot, "uploads");
      archive.finalize().catch(fail);
    });

    const stat = fs.statSync(tmpPath);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "no-store");

    await pipeline(fs.createReadStream(tmpPath), res);
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}
