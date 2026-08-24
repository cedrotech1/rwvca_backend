require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const admin = new Client({
    host: process.env.DEV_DATABASE_HOST,
    port: process.env.DEV_DATABASE_PORT,
    user: process.env.DEV_DATABASE_USER,
    password: process.env.DEV_DATABASE_PASSWORD,
    database: "postgres",
  });

  await admin.connect();
  const result = await admin.query("SELECT datname FROM pg_database ORDER BY 1");
  const names = result.rows.map((row) => row.datname);
  console.log("DATABASES:", names.join(", "));

  const name = process.env.DEV_DATABASE_NAME;
  const exists = names.includes(name) || names.includes(name.toLowerCase());

  if (!exists) {
    await admin.query(`CREATE DATABASE "${name.replace(/"/g, "")}"`);
    console.log("CREATED", name);
  } else {
    console.log("EXISTS", names.includes(name) ? name : name.toLowerCase());
  }

  await admin.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
