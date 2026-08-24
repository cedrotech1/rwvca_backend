require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const client = new Client({
    host: process.env.DEV_DATABASE_HOST,
    port: process.env.DEV_DATABASE_PORT,
    user: process.env.DEV_DATABASE_USER,
    password: process.env.DEV_DATABASE_PASSWORD,
    database: process.env.DEV_DATABASE_NAME,
  });
  await client.connect();
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log("TABLE_COUNT", tables.rows.length);
  console.log(tables.rows.map((row) => row.tablename).join("\n"));
  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
