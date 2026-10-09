"""Convert a PostgreSQL pg_dump file into a MySQL import."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "rwvca-database-2026-10-09.sql"
OUT = ROOT / "rwvca-mysql-2026-10-09.sql"

IDENT = r'(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))'


def quote_ident(name):
    return "`" + name.replace("`", "``") + "`"


def quote_str(value):
    text = value.replace("\\", "\\\\").replace("'", "''").replace("\x00", "")
    return "'" + text + "'"


def unescape_copy(value):
    if value == r"\N":
        return None
    out = []
    i = 0
    while i < len(value):
        if value[i] != "\\":
            out.append(value[i])
            i += 1
            continue
        i += 1
        if i >= len(value):
            break
        code = value[i]
        mapping = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "v": "\v", "\\": "\\"}
        out.append(mapping.get(code, code))
        i += 1
    return "".join(out)


def mysql_type(raw, enums):
    raw = raw.strip()
    enum_name = raw.split(".")[-1]
    if enum_name in enums:
        labels = ",".join(quote_str(label) for label in enums[enum_name])
        return f"ENUM({labels})"
    if raw.startswith("character varying"):
        match = re.search(r"\((\d+)\)", raw)
        return f"VARCHAR({match.group(1)})" if match else "LONGTEXT"
    if raw.startswith("character("):
        match = re.search(r"\((\d+)\)", raw)
        return f"CHAR({match.group(1)})" if match else "CHAR(1)"
    if raw.startswith("numeric"):
        match = re.search(r"\((\d+)\s*,\s*(\d+)\)", raw)
        return f"DECIMAL({match.group(1)},{match.group(2)})" if match else "DECIMAL(20,6)"
    return {
        "integer": "INT",
        "bigint": "BIGINT",
        "smallint": "SMALLINT",
        "text": "LONGTEXT",
        "date": "DATE",
        "boolean": "TINYINT(1)",
        "json": "JSON",
        "jsonb": "JSON",
        "bytea": "LONGBLOB",
        "real": "FLOAT",
        "double precision": "DOUBLE",
        "timestamp with time zone": "DATETIME",
        "timestamp without time zone": "DATETIME",
        "time without time zone": "TIME",
        "uuid": "CHAR(36)",
    }.get(raw, "LONGTEXT")


def sql_literal(value, col_type):
    if value is None:
        return "NULL"
    if col_type == "TINYINT(1)" and value in ("t", "f", "true", "false"):
        return "1" if value in ("t", "true") else "0"
    if col_type == "DATETIME":
        value = re.sub(r"(\.\d+)?([+-]\d{2}(:\d{2})?|Z)$", "", value)
    if col_type in ("INT", "BIGINT", "SMALLINT", "FLOAT", "DOUBLE") or col_type.startswith("DECIMAL"):
        if re.fullmatch(r"-?\d+(\.\d+)?", value):
            return value
    return quote_str(value)


def parse_ident(token):
    token = token.strip()
    if token.startswith('"') and token.endswith('"'):
        return token[1:-1]
    if token.startswith("public."):
        token = token[len("public."):]
    if token.startswith('"') and token.endswith('"'):
        return token[1:-1]
    return token.strip('"')


def main():
    enums = {}
    tables = {}
    order = []
    auto_columns = set()
    primary_keys = {}
    indexes = []
    foreign_keys = []
    copy_columns = {}
    current_enum = None
    current_table = None
    copy_table = None
    copy_cols = None
    pending_alter = None

    text = SRC.read_text(encoding="utf-8")
    lines = text.splitlines()

    for line in lines:
        if line.startswith("CREATE TYPE public."):
            current_enum = line.split("public.", 1)[1].split(" ", 1)[0]
            enums[current_enum] = []
            continue
        if current_enum and line.strip() == ");":
            current_enum = None
            continue
        if current_enum and "'" in line:
            enums[current_enum].append(line.strip().strip(",").strip("'"))
            continue

        if line.startswith("CREATE TABLE public."):
            current_table = parse_ident(line.split("public.", 1)[1].split(" ", 1)[0])
            tables[current_table] = []
            order.append(current_table)
            continue
        if current_table and line.strip() == ");":
            current_table = None
            continue
        if current_table and line.startswith("    "):
            body = line.strip().rstrip(",")
            match = re.match(r'^"([^"]+)"\s+(.*)$', body) or re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s+(.*)$", body)
            if not match:
                continue
            name, rest = match.group(1), match.group(2)
            not_null = "NOT NULL" in rest
            type_src = re.split(r"\s+DEFAULT\s+|\s+NOT NULL", rest, maxsplit=1)[0].strip()
            tables[current_table].append({
                "name": name,
                "type": mysql_type(type_src, enums),
                "not_null": not_null,
            })
            continue

        seq = re.match(
            r"^ALTER TABLE ONLY public\.(?P<table>.+) ALTER COLUMN (?P<col>.+) SET DEFAULT nextval\(",
            line,
        )
        if seq:
            auto_columns.add((parse_ident(seq.group("table")), parse_ident(seq.group("col"))))
            continue

        if line.startswith("ALTER TABLE ONLY public."):
            pending_alter = parse_ident(line.split("public.", 1)[1].strip())
            continue
        if pending_alter and "PRIMARY KEY" in line:
            cols = re.search(r"PRIMARY KEY \((.+)\)", line).group(1)
            primary_keys[pending_alter] = [parse_ident(part) for part in cols.split(",")]
            pending_alter = None
            continue
        if pending_alter and "FOREIGN KEY" in line:
            match = re.search(
                r"ADD CONSTRAINT (\S+) FOREIGN KEY \((.+)\) REFERENCES public\.([A-Za-z0-9_]+)\((.+)\)(.*);",
                line,
            )
            if match:
                foreign_keys.append({
                    "table": pending_alter,
                    "name": parse_ident(match.group(1)),
                    "columns": [parse_ident(part) for part in match.group(2).split(",")],
                    "ref_table": parse_ident(match.group(3)),
                    "ref_columns": [parse_ident(part) for part in match.group(4).split(",")],
                    "tail": match.group(5).strip(),
                })
            pending_alter = None
            continue
        if pending_alter and line.strip().endswith(";"):
            pending_alter = None

        index = re.match(
            r"^CREATE (UNIQUE )?INDEX (\S+) ON public\.(.+?) USING btree \((.+)\);",
            line,
        )
        if index:
            indexes.append({
                "unique": bool(index.group(1)),
                "name": index.group(2),
                "table": parse_ident(index.group(3)),
                "columns": [parse_ident(part.strip()) for part in index.group(4).split(",")],
            })
            continue

        copy = re.match(r"^COPY public\.(.+?) \((.+)\) FROM stdin;", line)
        if copy:
            copy_table = parse_ident(copy.group(1))
            copy_cols = [parse_ident(part.strip()) for part in copy.group(2).split(",")]
            copy_columns[copy_table] = copy_cols
            continue
        if copy_table and line == r"\.":
            copy_table = None
            copy_cols = None

    indexes_by_table = {}
    for index in indexes:
        indexes_by_table.setdefault(index["table"], []).append(index)

    out = OUT.open("w", encoding="utf-8", newline="\n")
    out.write("-- MySQL import converted from rwvca-database-2026-10-09.sql.\n")
    out.write("SET NAMES utf8mb4;\n")
    out.write("SET FOREIGN_KEY_CHECKS = 0;\n")
    out.write("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n")
    out.write("CREATE DATABASE IF NOT EXISTS `rwvca_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n")
    out.write("USE `rwvca_db`;\n\n")

    for table in order:
        columns = tables[table]
        lines_sql = []
        for column in columns:
            piece = f"  {quote_ident(column['name'])} {column['type']}"
            if (table, column["name"]) in auto_columns:
                piece += " NOT NULL AUTO_INCREMENT"
            elif column["not_null"]:
                piece += " NOT NULL"
            else:
                piece += " NULL"
            lines_sql.append(piece)
        if table in primary_keys:
            cols = ", ".join(quote_ident(name) for name in primary_keys[table])
            lines_sql.append(f"  PRIMARY KEY ({cols})")
        for index in indexes_by_table.get(table, []):
            cols = ", ".join(quote_ident(name) for name in index["columns"])
            kind = "UNIQUE KEY" if index["unique"] else "KEY"
            lines_sql.append(f"  {kind} {quote_ident(index['name'])} ({cols})")
        out.write(f"DROP TABLE IF EXISTS {quote_ident(table)};\n")
        out.write(f"CREATE TABLE {quote_ident(table)} (\n" + ",\n".join(lines_sql) + "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n")

    copy_table = None
    copy_cols = None
    col_types = {}
    batch = []
    row_counts = {}

    def flush():
        nonlocal batch
        if not batch:
            return
        cols = ", ".join(quote_ident(name) for name in copy_cols)
        out.write(f"INSERT INTO {quote_ident(copy_table)} ({cols}) VALUES\n" + ",\n".join(batch) + ";\n")
        batch = []

    for line in lines:
        copy = re.match(r"^COPY public\.(.+?) \((.+)\) FROM stdin;", line)
        if copy:
            copy_table = parse_ident(copy.group(1))
            copy_cols = [parse_ident(part.strip()) for part in copy.group(2).split(",")]
            by_name = {column["name"]: column["type"] for column in tables[copy_table]}
            col_types = [by_name[name] for name in copy_cols]
            row_counts[copy_table] = 0
            continue
        if copy_table and line == r"\.":
            flush()
            out.write("\n")
            copy_table = None
            continue
        if not copy_table:
            continue
        values = []
        for raw, col_type in zip(line.split("\t"), col_types):
            values.append(sql_literal(unescape_copy(raw), col_type))
        batch.append("(" + ", ".join(values) + ")")
        row_counts[copy_table] += 1
        if len(batch) == 80:
            flush()

    for fk in foreign_keys:
        cols = ", ".join(quote_ident(name) for name in fk["columns"])
        refs = ", ".join(quote_ident(name) for name in fk["ref_columns"])
        tail = fk["tail"] or "ON UPDATE RESTRICT ON DELETE RESTRICT"
        out.write(
            f"ALTER TABLE {quote_ident(fk['table'])} ADD CONSTRAINT {quote_ident(fk['name'])} "
            f"FOREIGN KEY ({cols}) REFERENCES {quote_ident(fk['ref_table'])} ({refs}) {tail};\n"
        )
    out.write("\nSET FOREIGN_KEY_CHECKS = 1;\n")
    out.close()
    filled = sum(1 for count in row_counts.values() if count)
    print(f"tables={len(order)} tables_with_rows={filled} rows={sum(row_counts.values())} file={OUT}")


if __name__ == "__main__":
    main()
