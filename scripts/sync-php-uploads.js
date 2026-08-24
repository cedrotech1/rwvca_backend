const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..", "uploads");
const phpRoot = path.resolve(process.env.PHP_PROJECT_ROOT || path.join(__dirname, "..", "..", "rwvca-platform-php"));

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(from, to);
    } else if (entry.isFile()) {
      if (!fs.existsSync(to)) {
        fs.copyFileSync(from, to);
        count += 1;
      }
    }
  }
  return count;
}

fs.mkdirSync(backendRoot, { recursive: true });

const copiedPublic = copyDir(path.join(phpRoot, "uploads"), backendRoot);
const copiedDocs = copyDir(
  path.join(phpRoot, "dashboard1", "uploads"),
  backendRoot
);

console.log(`Synced PHP uploads into BACKEND/uploads`);
console.log(`  public/root files copied: ${copiedPublic}`);
console.log(`  dashboard files copied: ${copiedDocs}`);
console.log(`  source: ${phpRoot}`);
console.log(`  dest: ${backendRoot}`);
