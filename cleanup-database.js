require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DEV_DATABASE_NAME,
  process.env.DEV_DATABASE_USER,
  process.env.DEV_DATABASE_PASSWORD,
  {
    host: process.env.DEV_DATABASE_HOST,
    port: process.env.DEV_DATABASE_PORT,
    dialect: "postgres",
    logging: false,
  }
);

async function cleanup() {
  await sequelize.query("DROP SCHEMA IF EXISTS public CASCADE");
  await sequelize.query("CREATE SCHEMA public");
  await sequelize.query("GRANT ALL ON SCHEMA public TO postgres");
  await sequelize.query("GRANT ALL ON SCHEMA public TO public");
  console.log("Dropped and recreated public schema on", process.env.DEV_DATABASE_NAME);
  await sequelize.close();
}

cleanup().catch((error) => {
  console.error(error);
  process.exit(1);
});
