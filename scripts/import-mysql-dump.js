require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const SKIP_TABLES = new Set(["members_schema_migrations", "SequelizeMeta"]);
const BATCH_SIZE = 200;

const dumpPath =
  process.argv[2] ||
  path.resolve(__dirname, "../../rwvca-platform-php/database.sql");

function unescapeMysqlString(value) {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = value[i + 1];
    i += 1;
    switch (next) {
      case "0":
        out += "\0";
        break;
      case "b":
        out += "\b";
        break;
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "Z":
        out += "\x1a";
        break;
      case "'":
      case '"':
      case "\\":
        out += next;
        break;
      default:
        out += next || "";
        break;
    }
  }
  return out;
}

function normalizeValue(value) {
  if (value === null) return null;
  if (typeof value !== "string") return value;
  if (value === "0000-00-00" || value === "0000-00-00 00:00:00") return null;
  return value;
}

function parseMysqlValues(sql, start) {
  const rows = [];
  let i = start;

  const skipWs = () => {
    while (i < sql.length && /\s/.test(sql[i])) i += 1;
  };

  skipWs();
  while (i < sql.length) {
    skipWs();
    if (sql[i] === ";") {
      i += 1;
      break;
    }
    if (sql[i] === ",") {
      i += 1;
      continue;
    }
    if (sql[i] !== "(") {
      throw new Error(`Expected '(' at position ${i}: ${sql.slice(i, i + 40)}`);
    }
    i += 1;

    const row = [];
    while (i < sql.length) {
      skipWs();
      if (sql[i] === ")") {
        i += 1;
        rows.push(row);
        break;
      }
      if (sql[i] === ",") {
        i += 1;
        continue;
      }

      if (sql.slice(i, i + 4).toUpperCase() === "NULL" && /[,)\s]/.test(sql[i + 4] || " ")) {
        row.push(null);
        i += 4;
        continue;
      }

      if (sql[i] === "'" || sql[i] === '"') {
        const quote = sql[i];
        i += 1;
        let raw = "";
        while (i < sql.length) {
          const ch = sql[i];
          if (ch === "\\") {
            raw += ch + (sql[i + 1] || "");
            i += 2;
            continue;
          }
          if (ch === quote) {
            if (sql[i + 1] === quote) {
              raw += quote;
              i += 2;
              continue;
            }
            i += 1;
            break;
          }
          raw += ch;
          i += 1;
        }
        row.push(normalizeValue(unescapeMysqlString(raw)));
        continue;
      }

      let token = "";
      while (i < sql.length && !/[,)\s]/.test(sql[i])) {
        token += sql[i];
        i += 1;
      }
      if (token === "") {
        throw new Error(`Empty token at position ${i}`);
      }
      if (/^-?\d+(\.\d+)?$/.test(token)) {
        row.push(token.includes(".") ? token : Number(token));
      } else {
        row.push(token);
      }
    }
  }

  return { rows, end: i };
}

function extractInserts(sql) {
  const inserts = [];
  const marker = "INSERT INTO `";
  let searchFrom = 0;

  while (searchFrom < sql.length) {
    const start = sql.indexOf(marker, searchFrom);
    if (start === -1) break;
    const tableStart = start + marker.length;
    const tableEnd = sql.indexOf("`", tableStart);
    const table = sql.slice(tableStart, tableEnd);
    const valuesAt = sql.indexOf("VALUES", tableEnd);
    if (valuesAt === -1) break;
    let i = valuesAt + 6;
    while (i < sql.length && /\s/.test(sql[i])) i += 1;
    const parsed = parseMysqlValues(sql, i);
    inserts.push({ table, rows: parsed.rows });
    searchFrom = parsed.end;
  }

  return inserts;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function getColumns(client, table) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

async function resetSequences(client) {
  const result = await client.query(`
    SELECT
      n.nspname AS schema,
      c.relname AS table,
      a.attname AS column,
      pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) AS seq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) IS NOT NULL
  `);

  for (const row of result.rows) {
    await client.query(
      `SELECT setval($1, COALESCE((SELECT MAX(${quoteIdent(row.column)}) FROM ${quoteIdent(row.table)}), 1), true)`,
      [row.seq]
    );
  }
}

async function insertRows(client, table, columns, rows) {
  if (!rows.length) return 0;
  let inserted = 0;
  const colSql = columns.map(quoteIdent).join(", ");

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const values = [];
    const placeholders = batch.map((row, rowIndex) => {
      const start = rowIndex * columns.length;
      const marks = columns.map((_, colIndex) => `$${start + colIndex + 1}`);
      values.push(...row);
      return `(${marks.join(", ")})`;
    });

    await client.query(
      `INSERT INTO ${quoteIdent(table)} (${colSql}) VALUES ${placeholders.join(", ")}`,
      values
    );
    inserted += batch.length;
  }
  return inserted;
}

async function main() {
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found: ${dumpPath}`);
  }

  console.log("Reading", dumpPath);
  const sql = fs.readFileSync(dumpPath, "utf8");
  const inserts = extractInserts(sql);
  console.log(`Found ${inserts.length} INSERT statements`);

  const client = new Client({
    host: process.env.DEV_DATABASE_HOST,
    port: process.env.DEV_DATABASE_PORT,
    user: process.env.DEV_DATABASE_USER,
    password: process.env.DEV_DATABASE_PASSWORD,
    database: process.env.DEV_DATABASE_NAME,
  });
  await client.connect();

  try {
    await client.query("BEGIN");

    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'SequelizeMeta'
      ORDER BY tablename
    `);
    const tables = tablesResult.rows.map((row) => row.tablename);
    if (tables.length) {
      await client.query(
        `TRUNCATE TABLE ${tables.map(quoteIdent).join(", ")} RESTART IDENTITY CASCADE`
      );
      console.log(`Truncated ${tables.length} tables`);
    }

    let total = 0;
    for (const insert of inserts) {
      if (SKIP_TABLES.has(insert.table)) {
        console.log(`Skipped ${insert.table}`);
        continue;
      }
      const columns = await getColumns(client, insert.table);
      if (!columns.length) {
        throw new Error(`Table ${insert.table} does not exist in PostgreSQL`);
      }

      const rows = insert.rows.map((row, index) => {
        if (row.length !== columns.length) {
          throw new Error(
            `${insert.table} row ${index + 1}: expected ${columns.length} columns, got ${row.length}`
          );
        }
        return row;
      });

      const count = await insertRows(client, insert.table, columns, rows);
      total += count;
      console.log(`Imported ${insert.table}: ${count} rows`);
    }

    await resetSequences(client);
    await client.query("COMMIT");
    console.log(`Done. Imported ${total} rows into ${process.env.DEV_DATABASE_NAME}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Import failed:", error.message);
  process.exit(1);
});
