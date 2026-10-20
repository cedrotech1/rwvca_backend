import dotenv from "dotenv";
dotenv.config();
const {
  DEV_DATABASE_NAME,
  DEV_DATABASE_USER,
  DEV_DATABASE_PASSWORD,
  DEV_DATABASE_HOST,
  DEV_DATABASE_PORT,
  PRO_DATABASE_NAME,
  PRO_DATABASE_USER,
  PRO_DATABASE_PASSWORD,
  PRO_DATABASE_HOST,
  PRO_DATABASE_PORT,
} = process.env;

function resolveDialect(explicit, port) {
  const named = String(explicit || "").trim().toLowerCase();
  if (named === "mysql" || named === "mariadb") return "mysql";
  if (named === "postgres" || named === "postgresql") return "postgres";
  if (String(port || "") === "3306") return "mysql";
  return "postgres";
}

function isLocalHost(host) {
  return ["localhost", "127.0.0.1", "::1"].includes(String(host || "").trim().toLowerCase());
}

function mysqlOptions(dialect) {
  if (dialect !== "mysql") return {};
  return {
    timezone: "+00:00",
    dialectOptions: {
      timezone: "+00:00",
      dateStrings: true,
    },
    define: {
      charset: "utf8mb4",
      collate: "utf8mb4_unicode_ci",
    },
  };
}

function buildConfig({ username, password, database, host, port, dialectEnv }) {
  const dialect = resolveDialect(dialectEnv, port);
  const remotePostgres = dialect === "postgres" && host && !isLocalHost(host);
  const mysql = mysqlOptions(dialect);
  return {
    username,
    password,
    database,
    host,
    port,
    dialect,
    ...mysql,
    dialectOptions: {
      ...(mysql.dialectOptions || {}),
      ...(remotePostgres
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {}),
    },
  };
}

module.exports = {
  development: buildConfig({
    username: DEV_DATABASE_USER,
    password: DEV_DATABASE_PASSWORD,
    database: DEV_DATABASE_NAME,
    host: DEV_DATABASE_HOST,
    port: DEV_DATABASE_PORT,
    dialectEnv: process.env.DEV_DATABASE_DIALECT,
  }),
  uat: buildConfig({
    username: process.env.UAT_DATABASE_USER || DEV_DATABASE_USER,
    password: process.env.UAT_DATABASE_PASSWORD || DEV_DATABASE_PASSWORD,
    database: process.env.UAT_DATABASE_NAME || "rwvca_uat",
    host: process.env.UAT_DATABASE_HOST || DEV_DATABASE_HOST,
    port: process.env.UAT_DATABASE_PORT || DEV_DATABASE_PORT,
    dialectEnv: process.env.UAT_DATABASE_DIALECT || "postgres",
  }),
  production: buildConfig({
    username: PRO_DATABASE_USER,
    password: PRO_DATABASE_PASSWORD,
    database: PRO_DATABASE_NAME,
    host: PRO_DATABASE_HOST,
    port: PRO_DATABASE_PORT,
    dialectEnv: process.env.PRO_DATABASE_DIALECT,
  }),
};
