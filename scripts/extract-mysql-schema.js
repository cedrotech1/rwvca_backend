const fs = require("fs");
const path = require("path");

const sqlPath = path.resolve(
  __dirname,
  "../../rwvca-platform-php/database.sql"
);
const outPath = path.resolve(__dirname, "schema.json");

const sql = fs.readFileSync(sqlPath, "utf8");
const tables = [];
const re = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE=/g;
let match;

while ((match = re.exec(sql))) {
  tables.push({ name: match[1], body: match[2].trim() });
}

fs.writeFileSync(outPath, JSON.stringify(tables, null, 2), "utf8");
console.log(`Extracted ${tables.length} tables`);
console.log(tables.map((t) => t.name).join("\n"));
