import nodemailer from "nodemailer";

const smtpPassword = () => process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
const mailFrom = () => process.env.MAIL_FROM || process.env.SMTP_USER;
const clientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

export const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && smtpPassword() && mailFrom());

const transporter = () => {
  if (!isEmailConfigured()) throw new Error("Email delivery is not configured");
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: { user: process.env.SMTP_USER, pass: smtpPassword() },
  });
};

const escape = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const layout = (title, body) => `
  <div style="font-family: Arial, sans-serif; color: #19271f; max-width: 560px; margin: 0 auto;">
    <div style="height: 5px; background: #506431;"></div>
    <div style="padding: 32px 24px; background: #f8faf6;">
      <p style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #40532a; text-transform: uppercase;">Keiyian Farmers Cooperative Society</p>
      <h1 style="font-size: 22px; margin: 20px 0 12px;">${title}</h1>
      ${body}
    </div>
  </div>`;

export const verifyEmailTransport = async () => {
  await transporter().verify();
  return true;
};

export const sendVerificationEmail = async ({ to, name, code }) => {
  const url = new URL("/verify-account", clientUrl());
  url.searchParams.set("email", to);
  await transporter().sendMail({
    from: mailFrom(),
    to,
    subject: "Verify your Keiyian ERP email address",
    text: `Hello ${name || "there"},\n\nYour verification code is ${code}. It expires in 10 minutes.\n\nVerify here: ${url}`,
    html: layout("Verify your email address", `
      <p>Hello ${escape(name)},</p>
      <p>Enter this code to confirm your email address:</p>
      <p style="font-size: 30px; font-weight: 700; letter-spacing: 8px; padding: 16px; background: #fff; border: 1px solid #e2e8f0; text-align: center;">${code}</p>
      <p style="font-size: 13px; color: #64748b;">The code expires in 10 minutes.</p>
      <p><a href="${url}" style="color: #40532a; font-weight: 700;">Open verification page</a></p>`),
  });
};

export const sendAccountEmail = async ({ to, name, password }) => {
  const url = new URL("/login", clientUrl());
  await transporter().sendMail({
    from: mailFrom(),
    to,
    subject: "Your Keiyian ERP account",
    text: `Hello ${name},\n\nAn account has been created for you.\nEmail: ${to}\nTemporary password: ${password}\n\nSign in at ${url} and choose a new password.`,
    html: layout("Your account is ready", `
      <p>Hello ${escape(name)},</p>
      <p>An account has been created for you on the Keiyian ERP.</p>
      <p>Email: <strong>${escape(to)}</strong><br/>Temporary password: <strong style="font-family: monospace;">${escape(password)}</strong></p>
      <p>You will be asked to choose your own password the first time you sign in.</p>
      <p><a href="${url}" style="color: #40532a; font-weight: 700;">Sign in</a></p>`),
  });
};
