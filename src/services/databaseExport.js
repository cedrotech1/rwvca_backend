import { spawn } from "node:child_process";
import { QueryTypes } from "sequelize";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BATCH = 200;

function quoteIdent(name) {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Refusing to export unsafe name: ${name}`);
  }
  return `"${name}"`;
}

function quoteText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlLiteral(value, udtName) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (value instanceof Date) return quoteText(value.toISOString());
  if (Buffer.isBuffer(value)) return `'\\x${value.toString("hex")}'`;

  const udt = String(udtName || "");
  if (Array.isArray(value) && (udt === "json" || udt === "jsonb")) {
    return `${quoteText(JSON.stringify(value))}::${udt}`;
  }
  if (Array.isArray(value)) {
    const itemType = udt.startsWith("_") ? udt.slice(1) : "";
    const items = value.map((item) => sqlLiteral(item, itemType)).join(", ");
    return `ARRAY[${items}]${udt.startsWith("_") ? `::${udt}` : ""}`;
  }
  if (typeof value === "object") {
    const cast = udt === "json" || udt === "jsonb" ? `::${udt}` : "";
    return `${quoteText(JSON.stringify(value))}${cast}`;
  }
  return quoteText(value);
}

async function listTables(sequelize) {
  return sequelize.query(
    `SELECT c.relname AS name
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.relname`,
    { type: QueryTypes.SELECT }
  );
}

async function listColumns(sequelize, table) {
  return sequelize.query(
    `SELECT column_name, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = :table
     ORDER BY ordinal_position`,
    { replacements: { table }, type: QueryTypes.SELECT }
  );
}

export async function writeDatabaseSql(sequelize, output) {
  const tables = await listTables(sequelize);
  const databaseName = sequelize.config?.database || "rwvca";
  output.write(`-- PostgreSQL database dump of ${databaseName}\n`);
  output.write(`-- Generated ${new Date().toISOString()}\n`);
  output.write(`BEGIN;\n\n`);

  for (const table of tables) {
    const name = table.name;
    const columns = await listColumns(sequelize, name);
    if (!columns.length) continue;
    const columnList = columns.map((column) => quoteIdent(column.column_name)).join(", ");
    const qualified = quoteIdent(name);
    let offset = 0;

    for (;;) {
      const rows = await sequelize.query(
        `SELECT * FROM ${qualified} LIMIT ${BATCH} OFFSET ${offset}`,
        { type: QueryTypes.SELECT }
      );
      if (!rows.length) break;
      for (const row of rows) {
        const values = columns
          .map((column) => sqlLiteral(row[column.column_name], column.udt_name))
          .join(", ");
        output.write(`INSERT INTO ${qualified} (${columnList}) VALUES (${values});\n`);
      }
      if (rows.length < BATCH) break;
      offset += BATCH;
    }
  }

  output.write(`COMMIT;\n`);
}

function spawnPgDump(sequelize) {
  const cfg = sequelize.config || {};
  const ssl = Boolean(sequelize.options?.dialectOptions?.ssl);
  return spawn(
    "pg_dump",
    [
      "--host", cfg.host || "localhost",
      "--port", String(cfg.port || 5432),
      "--username", cfg.username || "",
      "--dbname", cfg.database || "",
      "--no-owner",
      "--no-privileges",
      "--format=p",
      "--encoding=UTF8",
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: cfg.password || "",
        PGSSLMODE: ssl ? "require" : process.env.PGSSLMODE || "prefer",
      },
    }
  );
}

export function sendDatabaseDump(sequelize, res, filename) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnPgDump(sequelize);
    } catch (error) {
      reject(error);
      return;
    }

    let started = false;
    let settled = false;
    let stderr = "";

    const begin = () => {
      if (started) return;
      started = true;
      res.setHeader("Content-Type", "application/sql; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    };

    const finishWithSql = () => {
      if (settled) return;
      settled = true;
      begin();
      writeDatabaseSql(sequelize, res).then(() => {
        res.end();
        resolve();
      }).catch(reject);
    };

    child.stdout.on("data", (chunk) => {
      begin();
      res.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        finishWithSql();
        return;
      }
      if (settled) return;
      settled = true;
      if (started) res.end();
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      if (!started) {
        finishWithSql();
        return;
      }
      settled = true;
      res.end();
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || "Database export failed"));
    });
  });
}
