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

module.exports = {
  development: {
    username: DEV_DATABASE_USER,
    password: DEV_DATABASE_PASSWORD,
    database: DEV_DATABASE_NAME,
    host: DEV_DATABASE_HOST,
    port: DEV_DATABASE_PORT,
    dialect: resolveDialect(process.env.DEV_DATABASE_DIALECT, DEV_DATABASE_PORT),
    ...mysqlOptions(resolveDialect(process.env.DEV_DATABASE_DIALECT, DEV_DATABASE_PORT)),
  },
  uat: {
    username: process.env.UAT_DATABASE_USER || DEV_DATABASE_USER,
    password: process.env.UAT_DATABASE_PASSWORD || DEV_DATABASE_PASSWORD,
    database: process.env.UAT_DATABASE_NAME || "rwvca_uat",
    host: process.env.UAT_DATABASE_HOST || DEV_DATABASE_HOST,
    port: process.env.UAT_DATABASE_PORT || DEV_DATABASE_PORT,
    dialect: "postgres",
  },
  production: (() => {
    const dialect = resolveDialect(process.env.PRO_DATABASE_DIALECT, PRO_DATABASE_PORT);
    const remotePostgres = dialect === "postgres"
      && PRO_DATABASE_HOST
      && !["localhost", "127.0.0.1"].includes(PRO_DATABASE_HOST);
    return {
      username: PRO_DATABASE_USER,
      password: PRO_DATABASE_PASSWORD,
      database: PRO_DATABASE_NAME,
      host: PRO_DATABASE_HOST,
      port: PRO_DATABASE_PORT,
      dialect,
      ...mysqlOptions(dialect),
      dialectOptions: {
        ...(mysqlOptions(dialect).dialectOptions || {}),
        ...(remotePostgres
          ? { ssl: { require: true, rejectUnauthorized: true } }
          : {}),
      },
    };
  })(),
};

