/**
 * Send a test reset-code email from local SMTP settings.
 *
 * Usage (from rwvca_backend):
 *   node scripts/test-email.js you@example.com
 *   npx babel-node scripts/test-email.js you@example.com
 */
require("dotenv").config();

const to = String(process.argv[2] || "").trim();
if (!to || !to.includes("@")) {
  console.error("Usage: node scripts/test-email.js you@example.com");
  process.exit(1);
}

const Email = require("../src/utils/mailer.js");

(async () => {
  if (!Email.smtpConfigured()) {
    console.error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env");
    process.exit(1);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  console.log("SMTP host:", process.env.SMTP_HOST || "mail.rwvca.org.rw");
  console.log("From:", process.env.EMAIL_FROM || process.env.SMTP_USER);
  console.log("To:", to);
  console.log("Test code:", code);

  const mailer = new Email({ email: to, names: "Local Test" }, null, code);
  const started = Date.now();
  await mailer.sendStrict("ResetPasswordCode", "RWVCA Local Email Test", "Password Reset", {
    forceSend: true,
  });
  console.log(`OK — email sent in ${Date.now() - started}ms`);
  console.log("Check inbox (and spam) for: RWVCA Local Email Test");
  process.exit(0);
})().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
