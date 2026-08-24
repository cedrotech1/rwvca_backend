const fs = require("fs");
const path = require("path");

const SKIP_TABLES = new Set(["members_schema_migrations"]);

const USER_FK_COLUMNS = new Set([
  "user_id",
  "created_by",
  "updated_by",
  "shared_by",
  "shared_to",
  "sender_id",
  "receiver_id",
  "performed_by_user_id",
  "assigned_to_user_id",
  "prepared_by",
  "sended_to",
  "verified_by",
  "approved_by",
  "viewer_id",
  "reverted_by",
  "submitted_by",
  "rejected_by",
  "authorized_by",
  "ed_user_id",
]);

const FK_ALIASES = {
  department_ID: "department",
  department_id: "department",
  eid: "events",
  year_id: "membership_years",
  product_id: "member_products",
  service_id: "services",
  created_by: "creator",
  submitted_by: "submitter",
  approved_by: "approver",
  prepared_by: "preparer",
  sended_to: "sendToUser",
  verified_by: "verifier",
  reverted_by: "reverter",
  rejected_by: "rejecter",
  authorized_by: "authorizer",
  shared_by: "sharedByUser",
  shared_to: "sharedToUser",
};

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "schema.json"), "utf8")
);

const modelsDir = path.resolve(__dirname, "../src/database/models");
const migrationsDir = path.resolve(__dirname, "../src/database/migrations");

fs.mkdirSync(modelsDir, { recursive: true });
fs.mkdirSync(migrationsDir, { recursive: true });
fs.mkdirSync(path.resolve(__dirname, "../src/database/seeders"), {
  recursive: true,
});

function toPascalCase(tableName) {
  return tableName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function parseDefault(raw) {
  if (raw == null) return undefined;
  const value = raw.trim();
  if (/^NULL$/i.test(value)) return null;
  if (/^CURRENT_TIMESTAMP(?:\(\d+\))?$/i.test(value)) return { literal: "CURRENT_TIMESTAMP" };
  if (/^(TRUE|FALSE)$/i.test(value)) return value.toUpperCase() === "TRUE";
  if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value;
}

function parseType(rawType) {
  const type = rawType.trim();
  const enumMatch = type.match(/^enum\((.*)\)$/i);
  if (enumMatch) {
    const values = [...enumMatch[1].matchAll(/'((?:[^']|'')*)'/g)].map((m) =>
      m[1].replace(/''/g, "'")
    );
    return { kind: "ENUM", values };
  }

  const decimalMatch = type.match(/^(decimal|numeric)\((\d+),(\d+)\)$/i);
  if (decimalMatch) {
    return {
      kind: "DECIMAL",
      precision: Number(decimalMatch[2]),
      scale: Number(decimalMatch[3]),
    };
  }

  const varcharMatch = type.match(/^(varchar|char)\((\d+)\)$/i);
  if (varcharMatch) {
    return { kind: "STRING", length: Number(varcharMatch[2]) };
  }

  if (/^tinyint\(1\)$/i.test(type)) return { kind: "INTEGER" };
  if (/^tinyint/i.test(type)) return { kind: "SMALLINT" };
  if (/^smallint/i.test(type)) return { kind: "SMALLINT" };
  if (/^bigint/i.test(type)) return { kind: "BIGINT" };
  if (/^(int|integer|mediumint)/i.test(type)) return { kind: "INTEGER" };
  if (/^(text|tinytext|mediumtext|longtext)/i.test(type)) return { kind: "TEXT" };
  if (/^longblob|^blob|^binary|^varbinary/i.test(type)) return { kind: "BLOB" };
  if (/^datetime|^timestamp/i.test(type)) return { kind: "DATE" };
  if (/^date$/i.test(type)) return { kind: "DATEONLY" };
  if (/^time$/i.test(type)) return { kind: "TIME" };
  if (/^json/i.test(type)) return { kind: "JSON" };
  if (/^float/i.test(type)) return { kind: "FLOAT" };
  if (/^double/i.test(type)) return { kind: "DOUBLE" };
  if (/^year/i.test(type)) return { kind: "INTEGER" };
  return { kind: "TEXT" };
}

function parseTable(tableName, body) {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean);

  const columns = [];
  const indexes = [];
  const uniques = [];
  let primaryKey = [];

  for (const line of lines) {
    if (/^PRIMARY KEY/i.test(line)) {
      primaryKey = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      continue;
    }
    if (/^UNIQUE KEY|^UNIQUE INDEX/i.test(line)) {
      const nameMatch = line.match(/`([^`]+)`/);
      const cols = line.match(/\((.*)\)/);
      const fields = [...(cols ? cols[1] : "").matchAll(/`([^`]+)`/g)].map(
        (m) => m[1]
      );
      uniques.push({ name: nameMatch ? nameMatch[1] : undefined, fields });
      continue;
    }
    if (/^(KEY|INDEX)\s+/i.test(line)) {
      const nameMatch = line.match(/`([^`]+)`/);
      const cols = line.match(/\((.*)\)/);
      const fields = [...(cols ? cols[1] : "").matchAll(/`([^`]+)`/g)].map(
        (m) => m[1]
      );
      indexes.push({ name: nameMatch ? nameMatch[1] : undefined, fields });
      continue;
    }
    if (/^CONSTRAINT|^FOREIGN KEY/i.test(line)) continue;
    if (!line.startsWith("`")) continue;

    const nameMatch = line.match(/^`([^`]+)`\s+(.+)$/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    let rest = nameMatch[2];
    rest = rest.replace(/\s+COMMENT\s+'([^']|'')*'/gi, "");
    rest = rest.replace(/\s+ON UPDATE CURRENT_TIMESTAMP(?:\(\d+\))?/gi, "");
    rest = rest.replace(/\s+COLLATE\s+\S+/gi, "");
    rest = rest.replace(/\s+CHARACTER SET\s+\S+/gi, "");
    rest = rest.replace(/\s+UNSIGNED/gi, "");

    const autoIncrement = /AUTO_INCREMENT/i.test(rest);
    rest = rest.replace(/\s*AUTO_INCREMENT/i, "");

    const allowNull = !/NOT NULL/i.test(rest);
    rest = rest.replace(/\s*NOT NULL/i, "");

    let defaultValue;
    const defMatch = rest.match(
      /\s+DEFAULT\s+((?:'(?:[^']|'')*')|(?:NULL)|(?:CURRENT_TIMESTAMP(?:\(\d+\))?)|(?:-?\d+(?:\.\d+)?)|(?:TRUE|FALSE))/i
    );
    if (defMatch) {
      defaultValue = parseDefault(defMatch[1]);
      rest = rest.replace(defMatch[0], "");
    }
    rest = rest.replace(/\s+NULL/gi, "").trim();

    const type = parseType(rest);
    if (
      defaultValue !== undefined &&
      defaultValue !== null &&
      typeof defaultValue === "string" &&
      /^-?\d+(\.\d+)?$/.test(defaultValue) &&
      ["INTEGER", "SMALLINT", "BIGINT", "DECIMAL", "FLOAT", "DOUBLE"].includes(
        type.kind
      )
    ) {
      defaultValue = Number(defaultValue);
    }

    columns.push({
      name,
      type,
      allowNull,
      autoIncrement,
      defaultValue,
    });
  }

  if (!primaryKey.length) {
    const idCol = columns.find((c) => c.name === "id");
    if (idCol) primaryKey = ["id"];
  }

  columns.forEach((col) => {
    col.primaryKey = primaryKey.includes(col.name);
  });

  return { name: tableName, columns, indexes, uniques, primaryKey };
}

function sequelizeTypeExpr(type, ns) {
  switch (type.kind) {
    case "INTEGER":
      return `${ns}.INTEGER`;
    case "SMALLINT":
      return `${ns}.SMALLINT`;
    case "BIGINT":
      return `${ns}.BIGINT`;
    case "STRING":
      return `${ns}.STRING(${type.length})`;
    case "TEXT":
      return `${ns}.TEXT`;
    case "DATE":
      return `${ns}.DATE`;
    case "DATEONLY":
      return `${ns}.DATEONLY`;
    case "TIME":
      return `${ns}.TIME`;
    case "BOOLEAN":
      return `${ns}.BOOLEAN`;
    case "JSON":
      return `${ns}.JSON`;
    case "BLOB":
      return `${ns}.BLOB`;
    case "FLOAT":
      return `${ns}.FLOAT`;
    case "DOUBLE":
      return `${ns}.DOUBLE`;
    case "DECIMAL":
      return `${ns}.DECIMAL(${type.precision}, ${type.scale})`;
    case "ENUM":
      return `${ns}.ENUM(${type.values.map((v) => JSON.stringify(v)).join(", ")})`;
    default:
      return `${ns}.TEXT`;
  }
}

function defaultExpr(value, ns, forModel) {
  if (value === undefined) return null;
  if (value === null) return "null";
  if (value && value.literal) {
    return forModel ? "DataTypes.NOW" : `${ns}.literal("CURRENT_TIMESTAMP")`;
  }
  return JSON.stringify(value);
}

function columnBlock(col, ns, forModel) {
  const lines = [];
  lines.push(`type: ${sequelizeTypeExpr(col.type, ns)},`);
  lines.push(`allowNull: ${col.allowNull},`);
  if (col.primaryKey) lines.push("primaryKey: true,");
  if (col.autoIncrement) lines.push("autoIncrement: true,");
  const def = defaultExpr(col.defaultValue, ns, forModel);
  if (def !== null) lines.push(`defaultValue: ${def},`);
  return lines;
}

function resolveFk(columnName, tableName, tableSet) {
  if (USER_FK_COLUMNS.has(columnName)) return "users";
  if (FK_ALIASES[columnName]) return FK_ALIASES[columnName];

  if (!/_id$/i.test(columnName) && columnName !== "eid") return null;

  const base = columnName.replace(/_id$/i, "");
  if (base === tableName || base === "parent" || base === "root") {
    return tableName;
  }
  if (tableSet.has(base)) return base;
  if (tableSet.has(`${base}s`)) return `${base}s`;
  if (base.endsWith("y") && tableSet.has(`${base.slice(0, -1)}ies`)) {
    return `${base.slice(0, -1)}ies`;
  }
  if (base.endsWith("s") && tableSet.has(base.slice(0, -1))) {
    return base.slice(0, -1);
  }
  return null;
}

function indent(lines, spaces) {
  const pad = " ".repeat(spaces);
  return lines.map((line) => `${pad}${line}`).join("\n");
}

const parsed = schema
  .filter((t) => !SKIP_TABLES.has(t.name))
  .map((t) => parseTable(t.name, t.body));

const tableSet = new Set(parsed.map((t) => t.name));
const modelNameByTable = {};
parsed.forEach((t) => {
  modelNameByTable[t.name] = toPascalCase(t.name);
});

const associationsByTable = {};
parsed.forEach((t) => {
  associationsByTable[t.name] = [];
});

parsed.forEach((table) => {
  table.columns.forEach((col) => {
    if (col.primaryKey) return;
    const target = resolveFk(col.name, table.name, tableSet);
    if (!target || !tableSet.has(target)) return;
    let asBelongs =
      FK_ALIASES[col.name] ||
      col.name.replace(/_id$/i, "").replace(/_ID$/, "") ||
      col.name;
    if (asBelongs === col.name) asBelongs = `${col.name}_rel`;
    if (asBelongs === table.name) asBelongs = `${asBelongs}Parent`;
    associationsByTable[table.name].push({
      type: "belongsTo",
      target,
      foreignKey: col.name,
      as: asBelongs,
    });
    associationsByTable[target].push({
      type: "hasMany",
      target: table.name,
      foreignKey: col.name,
      as: `${table.name}_${col.name}`,
    });
  });
});

function uniqueAs(list) {
  const used = new Set();
  return list.map((assoc) => {
    let alias = assoc.as.replace(/[^a-zA-Z0-9_]/g, "_");
    if (used.has(alias)) alias = `${alias}_${assoc.foreignKey}`;
    used.add(alias);
    return { ...assoc, as: alias };
  });
}

Object.keys(associationsByTable).forEach((table) => {
  associationsByTable[table] = uniqueAs(associationsByTable[table]);
});

function writeModel(table) {
  const modelName = modelNameByTable[table.name];
  const hasCreated = table.columns.some((c) => c.name === "created_at");
  const hasUpdated = table.columns.some((c) => c.name === "updated_at");
  const hasDeleted = table.columns.some((c) => c.name === "deleted_at");
  const assocs = associationsByTable[table.name] || [];

  const assocLines = assocs.map((assoc) => {
    const targetModel = modelNameByTable[assoc.target];
    return `      ${modelName}.${assoc.type}(models.${targetModel}, { foreignKey: "${assoc.foreignKey}", as: "${assoc.as}" });`;
  });

  const attrLines = table.columns.map((col) => {
    const inner = columnBlock(col, "DataTypes", true)
      .map((line) => `        ${line}`)
      .join("\n");
    return `      ${col.name}: {\n${inner}\n      }`;
  });

  const options = [
    "      sequelize,",
    `      modelName: "${modelName}",`,
    `      tableName: "${table.name}",`,
    `      timestamps: ${hasCreated || hasUpdated},`,
    `      createdAt: ${hasCreated ? '"created_at"' : "false"},`,
    `      updatedAt: ${hasUpdated ? '"updated_at"' : "false"},`,
  ];
  if (hasDeleted) {
    options.push("      paranoid: true,");
    options.push('      deletedAt: "deleted_at",');
  }

  const content = `"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ${modelName} extends Model {
    static associate(models) {
${assocLines.length ? assocLines.join("\n") : "      // associations defined from PHP schema foreign-key columns"}
    }
  }

  ${modelName}.init(
    {
${attrLines.join(",\n")}
    },
    {
${options.join("\n")}
    }
  );

  return ${modelName};
};
`;

  fs.writeFileSync(path.join(modelsDir, `${table.name}.js`), content, "utf8");
}

function writeMigration(table, index) {
  const seq = String(index + 1).padStart(2, "0");
  const fileName = `202401010000${seq}-create-${table.name.replace(/_/g, "-")}.js`;

  const attrLines = table.columns.map((col) => {
    const inner = columnBlock(col, "Sequelize", false)
      .map((line) => `        ${line}`)
      .join("\n");
    return `      ${col.name}: {\n${inner}\n      }`;
  });

  const indexCalls = [];
  table.uniques.forEach((u) => {
    const raw = u.name || `${u.fields.join("_")}_unique`;
    const name = raw.startsWith(table.name) ? raw : `${table.name}_${raw}`;
    indexCalls.push(
      `    await queryInterface.addIndex("${table.name}", ${JSON.stringify(
        u.fields
      )}, { unique: true, name: ${JSON.stringify(name)} });`
    );
  });
  table.indexes.forEach((u) => {
    const raw = u.name || `${u.fields.join("_")}_idx`;
    const name = raw.startsWith(table.name) ? raw : `${table.name}_${raw}`;
    indexCalls.push(
      `    await queryInterface.addIndex("${table.name}", ${JSON.stringify(
        u.fields
      )}, { name: ${JSON.stringify(name)} });`
    );
  });

  const content = `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('${table.name}', {
${attrLines.join(",\n")}
    });
${indexCalls.length ? `${indexCalls.join("\n")}\n` : ""}  },

  async down(queryInterface) {
    await queryInterface.dropTable('${table.name}');
  },
};
`;

  fs.writeFileSync(path.join(migrationsDir, fileName), content, "utf8");
}

const indexJs = `"use strict";

import { readdirSync } from "fs";
import { basename as _basename, join } from "path";
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const basename = _basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require("../config/config.js")[env];

const db = {};

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

readdirSync(__dirname)
  .filter((file) => {
    return file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js";
  })
  .forEach((file) => {
    const model = sequelize.import(join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
`;

parsed.forEach((table, index) => {
  writeModel(table);
  writeMigration(table, index);
});

fs.writeFileSync(path.join(modelsDir, "index.js"), indexJs, "utf8");
fs.writeFileSync(
  path.resolve(__dirname, "../src/database/seeders/.gitkeep"),
  "",
  "utf8"
);

console.log(`Generated ${parsed.length} models and migrations`);
console.log(parsed.map((t) => t.name).join("\n"));
