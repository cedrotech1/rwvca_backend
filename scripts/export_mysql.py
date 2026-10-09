"""One-off export of the production Postgres database as MySQL SQL."""
import json
from datetime import date, datetime, time, timezone
from decimal import Decimal
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
OUT_PATH = ROOT / "rwvca-mysql-2026-10-09.sql"


def load_env(path):
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def quote_ident(name):
    return "`" + str(name).replace("`", "``") + "`"


def quote_str(value):
    text = str(value)
    text = text.replace("\\", "\\\\").replace("'", "''").replace("\x00", "")
    return "'" + text + "'"


def mysql_type(column, enums):
    data_type = column["data_type"]
    udt = column["udt_name"]
    length = column["character_maximum_length"]
    precision = column["numeric_precision"]
    scale = column["numeric_scale"]

    if data_type == "ARRAY":
        return "JSON"
    if udt in enums:
        labels = ",".join(quote_str(label) for label in enums[udt])
        return f"ENUM({labels})"
    if data_type in ("character varying", "character"):
        kind = "CHAR" if data_type == "character" else "VARCHAR"
        if length and length <= 16383:
            return f"{kind}({length})"
        return "LONGTEXT"
    if data_type == "text":
        return "LONGTEXT"
    if data_type == "boolean":
        return "TINYINT(1)"
    if data_type == "smallint":
        return "SMALLINT"
    if data_type == "integer":
        return "INT"
    if data_type == "bigint":
        return "BIGINT"
    if data_type == "real":
        return "FLOAT"
    if data_type == "double precision":
        return "DOUBLE"
    if data_type == "numeric":
        if precision:
            return f"DECIMAL({precision},{scale or 0})"
        return "DECIMAL(20,6)"
    if data_type == "date":
        return "DATE"
    if data_type == "time without time zone":
        return "TIME"
    if data_type.startswith("timestamp"):
        return "DATETIME"
    if data_type in ("json", "jsonb"):
        return "JSON"
    if data_type == "uuid":
        return "CHAR(36)"
    if data_type == "bytea":
        return "LONGBLOB"
    if udt == "citext":
        return "VARCHAR(255)"
    return "LONGTEXT"


def sql_value(value, column):
    if value is None:
        return "NULL"
    data_type = column["data_type"]
    if isinstance(value, bool) or data_type == "boolean":
        return "1" if value else "0"
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return quote_str(value.strftime("%Y-%m-%d %H:%M:%S"))
    if isinstance(value, date):
        return quote_str(value.isoformat())
    if isinstance(value, time):
        return quote_str(value.strftime("%H:%M:%S"))
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (dict, list)):
        return quote_str(json.dumps(value, ensure_ascii=False, default=str))
    if isinstance(value, (bytes, memoryview)):
        raw = bytes(value)
        return "X'" + raw.hex() + "'"
    if data_type in ("json", "jsonb", "ARRAY"):
        if not isinstance(value, str):
            value = json.dumps(value, ensure_ascii=False, default=str)
        return quote_str(value)
    if isinstance(value, (int, float)) and data_type in (
        "smallint", "integer", "bigint", "real", "double precision", "numeric"
    ):
        return str(value)
    return quote_str(value)


def main():
    env = load_env(ENV_PATH)
    conn = psycopg.connect(
        host=env["PRO_DATABASE_HOST"],
        port=env["PRO_DATABASE_PORT"],
        dbname=env["PRO_DATABASE_NAME"],
        user=env["PRO_DATABASE_USER"],
        password=env["PRO_DATABASE_PASSWORD"],
        sslmode="require",
        gssencmode="disable",
        connect_timeout=40,
        row_factory=dict_row,
    )
    conn.execute("SET statement_timeout = 0")

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.typname AS name, e.enumlabel AS label
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            ORDER BY t.typname, e.enumsortorder
            """
        )
        enums = {}
        for row in cur.fetchall():
            enums.setdefault(row["name"], []).append(row["label"])

        cur.execute(
            """
            SELECT c.table_name, c.column_name, c.data_type, c.udt_name,
                   c.character_maximum_length, c.numeric_precision, c.numeric_scale,
                   c.is_nullable, c.column_default, c.is_identity
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_schema = c.table_schema AND t.table_name = c.table_name
            WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
            ORDER BY c.table_name, c.ordinal_position
            """
        )
        tables = {}
        for row in cur.fetchall():
            tables.setdefault(row["table_name"], []).append(row)

        cur.execute(
            """
            SELECT tc.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
             AND tc.table_name = kcu.table_name
            WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
            ORDER BY tc.table_name, kcu.ordinal_position
            """
        )
        primary_keys = {}
        for row in cur.fetchall():
            primary_keys.setdefault(row["table_name"], []).append(row["column_name"])

        cur.execute(
            """
            SELECT con.conname AS constraint_name,
                   src.relname AS table_name,
                   att.attname AS column_name,
                   dst.relname AS foreign_table,
                   fatt.attname AS foreign_column,
                   con.confupdtype AS update_rule,
                   con.confdeltype AS delete_rule
            FROM pg_constraint con
            JOIN pg_class src ON src.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = src.relnamespace
            JOIN pg_class dst ON dst.oid = con.confrelid
            JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS ord(attnum, n) ON true
            JOIN pg_attribute att ON att.attrelid = src.oid AND att.attnum = ord.attnum
            JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS ford(attnum, n) ON ford.n = ord.n
            JOIN pg_attribute fatt ON fatt.attrelid = dst.oid AND fatt.attnum = ford.attnum
            WHERE con.contype = 'f' AND n.nspname = 'public'
            ORDER BY src.relname, con.conname, ord.n
            """
        )
        foreign_keys = {}
        for row in cur.fetchall():
            item = foreign_keys.setdefault(row["constraint_name"], {
                "table": row["table_name"],
                "columns": [],
                "foreign_table": row["foreign_table"],
                "foreign_columns": [],
                "update_rule": row["update_rule"],
                "delete_rule": row["delete_rule"],
            })
            item["columns"].append(row["column_name"])
            item["foreign_columns"].append(row["foreign_column"])

        cur.execute(
            """
            SELECT t.relname AS table_name, i.relname AS index_name,
                   a.attname AS column_name, ix.indisunique
            FROM pg_index ix
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (ix.indkey)
            WHERE n.nspname = 'public'
              AND NOT ix.indisprimary
              AND ix.indexprs IS NULL
              AND ix.indpred IS NULL
            ORDER BY t.relname, i.relname, array_position(ix.indkey, a.attnum)
            """
        )
        indexes = {}
        for row in cur.fetchall():
            item = indexes.setdefault((row["table_name"], row["index_name"]), {
                "unique": row["indisunique"],
                "columns": [],
            })
            item["columns"].append(row["column_name"])

    out = OUT_PATH.open("w", encoding="utf-8", newline="\n")
    out.write("-- RWVCA MySQL import generated from PostgreSQL\n")
    out.write("-- Timestamps are stored as UTC DATETIME.\n")
    out.write("SET NAMES utf8mb4;\n")
    out.write("SET FOREIGN_KEY_CHECKS = 0;\n")
    out.write("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n")
    out.write("CREATE DATABASE IF NOT EXISTS `rwvca_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n")
    out.write("USE `rwvca_db`;\n\n")

    for table, columns in tables.items():
        pk = primary_keys.get(table, [])
        lines = []
        for column in columns:
            default = column["column_default"] or ""
            auto = column["is_identity"] == "YES" or default.startswith("nextval(")
            piece = f"  {quote_ident(column['column_name'])} {mysql_type(column, enums)}"
            if auto:
                piece += " NOT NULL AUTO_INCREMENT"
            elif column["is_nullable"] == "NO":
                piece += " NOT NULL"
            else:
                piece += " NULL"
            lines.append(piece)
        if pk:
            cols = ", ".join(quote_ident(name) for name in pk)
            lines.append(f"  PRIMARY KEY ({cols})")
        for (table_name, index_name), index in indexes.items():
            if table_name != table:
                continue
            cols = ", ".join(quote_ident(name) for name in index["columns"])
            kind = "UNIQUE KEY" if index["unique"] else "KEY"
            lines.append(f"  {kind} {quote_ident(index_name)} ({cols})")
        out.write(f"DROP TABLE IF EXISTS {quote_ident(table)};\n")
        out.write(f"CREATE TABLE {quote_ident(table)} (\n")
        out.write(",\n".join(lines))
        out.write("\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n")

    total_rows = 0
    with conn.cursor() as cur:
        for table, columns in tables.items():
            names = [column["column_name"] for column in columns]
            by_name = {column["column_name"]: column for column in columns}
            cur.execute(f'SELECT * FROM public."{table.replace(chr(34), "")}"')
            rows = cur.fetchall()
            total_rows += len(rows)
            print(f"{table}: {len(rows)}", flush=True)
            if not rows:
                continue
            col_sql = ", ".join(quote_ident(name) for name in names)
            batch = []
            for row in rows:
                values = ", ".join(sql_value(row[name], by_name[name]) for name in names)
                batch.append(f"({values})")
                if len(batch) == 100:
                    out.write(
                        f"INSERT INTO {quote_ident(table)} ({col_sql}) VALUES\n"
                        + ",\n".join(batch)
                        + ";\n"
                    )
                    batch = []
            if batch:
                out.write(
                    f"INSERT INTO {quote_ident(table)} ({col_sql}) VALUES\n"
                    + ",\n".join(batch)
                    + ";\n"
                )
            out.write("\n")

    rule_map = {
        "c": "CASCADE",
        "n": "SET NULL",
        "d": "RESTRICT",
        "r": "RESTRICT",
        "a": "RESTRICT",
    }
    for name, fk in foreign_keys.items():
        cols = ", ".join(quote_ident(column) for column in fk["columns"])
        refs = ", ".join(quote_ident(column) for column in fk["foreign_columns"])
        on_delete = rule_map.get(fk["delete_rule"], "RESTRICT")
        on_update = rule_map.get(fk["update_rule"], "RESTRICT")
        out.write(
            f"ALTER TABLE {quote_ident(fk['table'])} ADD CONSTRAINT {quote_ident(name)} "
            f"FOREIGN KEY ({cols}) REFERENCES {quote_ident(fk['foreign_table'])} ({refs}) "
            f"ON DELETE {on_delete} ON UPDATE {on_update};\n"
        )

    out.write("\nSET FOREIGN_KEY_CHECKS = 1;\n")
    out.close()
    conn.close()
    print(f"tables={len(tables)} rows={total_rows} file={OUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
