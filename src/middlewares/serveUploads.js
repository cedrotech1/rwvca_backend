const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const {
  resolveUploadFilePath,
  isPublicStoredPath,
  backendUploadsRoot,
} = require("../utils/fileStorage.js");

function getToken(req) {
  const bearer = req.headers.authorization;
  const queryToken = req.query.token;
  if (bearer && bearer.startsWith("Bearer ")) return bearer.split(" ")[1];
  if (typeof queryToken === "string" && queryToken.length > 0) return queryToken;
  return null;
}

function serveUploads() {
  const root = backendUploadsRoot();

  return (req, res) => {
    const relative = String(req.path || "").replace(/^\/+/, "");
    if (!relative || relative.includes("..")) {
      return res.status(400).json({ success: false, message: "Invalid path" });
    }

    const stored = `uploads/${relative}`;
    const publicFile = isPublicStoredPath(stored);

    if (!publicFile) {
      const token = getToken(req);
      if (!token) {
        return res.status(401).json({ success: false, message: "Not authorized" });
      }
      try {
        jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ success: false, message: "Not authorized" });
      }
    }

    const resolved = resolveUploadFilePath(stored);
    if (!resolved || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const resolvedAbs = path.resolve(resolved);
    const allowedRoots = [
      path.resolve(root),
      path.resolve(process.env.PHP_PROJECT_ROOT || path.join(process.cwd(), "..", "rwvca-platform-php")),
    ];
    const inside = allowedRoots.some((base) => resolvedAbs === base || resolvedAbs.startsWith(base + path.sep));
    if (!inside) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const downloadName = path.basename(resolvedAbs).replace(/"/g, "");
    const asAttachment = String(req.query.download || "") === "1";
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename="${downloadName}"`
    );
    return res.sendFile(resolvedAbs);
  };
}

module.exports = { serveUploads };
