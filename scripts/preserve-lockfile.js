"use strict";

const fs = require("fs");
const path = require("path");

// cPanel runs npm install inside the git checkout. npm rewrites
// package-lock.json, and the next deploy then refuses to pull.
// Keep a copy from before install and put it back afterward.
const keep = path.join("/tmp", "rwvca-package-lock.keep");
const lock = path.join(process.cwd(), "package-lock.json");

function shouldPreserve() {
  if (process.env.KEEP_LOCKFILE === "1") return false;
  if (fs.existsSync("/.dockerenv") || fs.existsSync("/run/.containerenv")) return true;
  const home = String(process.env.HOME || "").replace(/\\/g, "/");
  return home.includes("/home/rwvcaorg");
}

const action = process.argv[2];

try {
  if (!shouldPreserve()) process.exit(0);
  if (action === "save" && fs.existsSync(lock)) {
    fs.copyFileSync(lock, keep);
  }
  if (action === "restore" && fs.existsSync(keep)) {
    fs.copyFileSync(keep, lock);
  }
} catch (err) {
  // Never fail the install because the lockfile could not be restored.
}

process.exit(0);
