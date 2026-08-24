import dotenv from "dotenv";
import app from "./app.js";
import { validateEnv } from "./config/validateEnv.js";

dotenv.config();
validateEnv();

const PORT = process.env.PORT || 5000;
// Render (and other PaaS) need 0.0.0.0 so the platform can detect an open port.
// Ignore HOST=127.0.0.1 / localhost when NODE_ENV=production (common .env mistake).
const isProd = process.env.NODE_ENV === "production";
const configuredHost = process.env.HOST;
const HOST =
  isProd && (!configuredHost || configuredHost === "127.0.0.1" || configuredHost === "localhost")
    ? "0.0.0.0"
    : configuredHost || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT} [${process.env.NODE_ENV || "development"}]`);
});
