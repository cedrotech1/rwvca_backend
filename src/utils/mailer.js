const ejs = require("ejs");
const path = require("path");
const nodemailer = require("nodemailer");
const { toPlainText } = require("./plainText.js");

const DEFAULT_SMTP = {
  host: "mail.rwvca.org.rw",
  port: 587,
  secure: "tls",
  user: "notification@rwvca.org.rw",
  from: "notification@rwvca.org.rw",
  fromName: "RWVCA MIS",
};

class Email {
  constructor(user, claim = null, url = null) {
    this.to = user.email;
    this.firstname = user.names || user.firstname;
    this.password = user.password;
    this.email = user.email;
    this.from = process.env.EMAIL_FROM || DEFAULT_SMTP.from;
    this.fromName = process.env.EMAIL_FROM_NAME || DEFAULT_SMTP.fromName;
    this.url = url;
    this.message = claim ? claim.message : "";
    this.emailPayload = null;
  }

  setEmailPayload(payload = {}) {
    this.emailPayload = payload || {};
    return this;
  }

  static smtpConfigured() {
    const host = process.env.SMTP_HOST || DEFAULT_SMTP.host;
    const user = process.env.SMTP_USER || DEFAULT_SMTP.user;
    const pass = process.env.SMTP_PASSWORD || "";
    return Boolean(host && user && pass);
  }

  static sendgridConfigured() {
    return Boolean(String(process.env.SENDGRID_API_KEY || "").trim());
  }

  static mailConfigured() {
    return Email.sendgridConfigured() || Email.smtpConfigured();
  }

  createTransport() {
    const smtpHost = process.env.SMTP_HOST || DEFAULT_SMTP.host;
    const smtpPort = parseInt(process.env.SMTP_PORT, 10) || DEFAULT_SMTP.port;
    const smtpUser = process.env.SMTP_USER || DEFAULT_SMTP.user;
    const smtpPass = process.env.SMTP_PASSWORD || "";
    const smtpSecure = String(process.env.SMTP_SECURE || DEFAULT_SMTP.secure).toLowerCase();

    if (!smtpPass) {
      throw new Error("SMTP_PASSWORD is not set. Copy the value from PHP send_email_function.php into BACKEND/.env");
    }

    const opts = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure === "ssl",
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 15000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30000),
      tls: {
        rejectUnauthorized: false,
        minVersion: "TLSv1.2",
      },
    };
    if (smtpSecure === "tls" || smtpSecure === "starttls") {
      opts.requireTLS = true;
    }
    return nodemailer.createTransport(opts);
  }

  static _emailSettingsCache = { value: null, at: 0 };

  static clearEmailSettingsCache() {
    Email._emailSettingsCache = { value: null, at: 0 };
  }

  async isEmailAllowed({ forceSend = false } = {}) {
    if (forceSend) return true;
    if (process.env.EMAIL_ENABLED === "false") return false;
    if (!Email.mailConfigured()) return false;

    const cache = Email._emailSettingsCache;
    if (cache.value !== null && Date.now() - cache.at < 60000) {
      return cache.value;
    }

    try {
      const settingsService = require("../services/settingsService.js");
      const allowed = await settingsService.isEmailNotificationEnabled();
      Email._emailSettingsCache = { value: allowed, at: Date.now() };
      return allowed;
    } catch (error) {
      console.error("Could not load email notification settings:", error.message);
      return false;
    }
  }

  async renderTemplate(template, subject) {
    const payload = this.emailPayload || {};
    const details = (payload.details || []).map((row) => ({
      ...row,
      label: toPlainText(row.label),
      value: toPlainText(row.value),
    }));
    return ejs.renderFile(path.join(__dirname, `./../views/email/${template}.ejs`), {
      firstname: this.firstname,
      password: this.password,
      email: this.email,
      url: this.url || null,
      message: toPlainText(this.message),
      heading: toPlainText(subject),
      intro: toPlainText(payload.intro),
      details,
      note: toPlainText(payload.note),
      actionRequired: toPlainText(payload.actionRequired),
    });
  }

  buildFromAddress() {
    return {
      name: this.fromName,
      address: this.from,
    };
  }

  async sendViaSendGrid({ to, from, subject, text, html }) {
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(String(process.env.SENDGRID_API_KEY).trim());
    await sgMail.send({
      to,
      from: {
        email: from.address,
        name: from.name,
      },
      subject,
      text,
      html,
    });
  }

  async deliverMail({ subject, title, html }) {
    const from = this.buildFromAddress();
    const text = `${title || subject}\n\nCode: ${this.url || ""}`.trim();
    const payload = { to: this.to, from, subject, text, html };

    // Prefer SendGrid HTTP API on hosts that block SMTP (e.g. Render free tier).
    if (Email.sendgridConfigured()) {
      console.log(`SENDING EMAIL via SendGrid to ${this.to}: ${subject}`);
      await this.sendViaSendGrid(payload);
      console.log(`Email sent successfully to ${this.to} (SendGrid)`);
      return "sendgrid";
    }

    if (!Email.smtpConfigured()) {
      const error = new Error(
        "No email transport configured. Set SENDGRID_API_KEY (recommended on Render) or SMTP_HOST/SMTP_USER/SMTP_PASSWORD."
      );
      error.status = 400;
      throw error;
    }

    console.log(`SENDING EMAIL via SMTP to ${this.to}: ${subject}`);
    const transporter = this.createTransport();
    await transporter.sendMail({
      to: this.to,
      from,
      subject,
      text,
      html,
    });
    console.log(`Email sent successfully to ${this.to} (SMTP)`);
    return "smtp";
  }

  async sendStrict(template, subject, title, { forceSend = false } = {}) {
    if (!Email.mailConfigured()) {
      const error = new Error(
        "Email is not configured. On Render free tier SMTP ports are blocked — set SENDGRID_API_KEY, or upgrade Render and set SMTP_*."
      );
      error.status = 400;
      throw error;
    }

    const emailAllowed = await this.isEmailAllowed({ forceSend });
    if (!emailAllowed) {
      const error = new Error("Email is disabled. Set send_email_notification = yes in Settings, or use force send for testing.");
      error.status = 400;
      throw error;
    }

    const html = await this.renderTemplate(template, title || subject);
    await this.deliverMail({ subject, title, html });
  }

  async send(template, subject, title, { forceSend = false } = {}) {
    const emailAllowed = await this.isEmailAllowed({ forceSend });
    if (!emailAllowed) {
      console.log(`EMAIL DISABLED - Skipping email to ${this.to}: ${subject}`);
      return;
    }

    if (!Email.mailConfigured()) {
      console.error(`Email not configured - Skipping email to ${this.to}: ${subject}`);
      return;
    }

    try {
      const html = await this.renderTemplate(template, title || subject);
      await this.deliverMail({ subject, title, html });
    } catch (error) {
      console.error(`Email failed to send to ${this.to}:`, error.message);
    }
  }

  async sendAccountAdded() {
    await this.send("accountAdded", "Welcome to RWVCA Portal - Your Account Has Been Created", "Welcome to RWVCA Portal");
  }

  async sendNotification(subject = "RWVCA Notification") {
    await this.send("Notification", subject, subject);
  }

  async sendReportNotification(subject, message) {
    const originalMessage = this.message;
    this.message = message;
    await this.send("Notification", subject, message);
    this.message = originalMessage;
  }

  async sendResetPasswordCode() {
    await this.send("ResetPasswordCode", "Your Reset Password Code", "Here is your reset password code.");
  }
}

module.exports = Email;
