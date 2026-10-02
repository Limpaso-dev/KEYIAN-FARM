import nodemailer from "nodemailer";

const smtpPassword = () => process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
const mailFrom = () => process.env.MAIL_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER;

export const isEmailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    smtpPassword() &&
    mailFrom()
  );

const createTransporter = () => {
  if (!isEmailConfigured()) {
    throw new Error("Email delivery is not configured");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPassword(),
    },
  });
};

export const verifyEmailTransport = async () => {
  const transporter = createTransporter();
  await transporter.verify();
  return true;
};

export const sendVerificationEmail = async ({ to, name, code }) => {
  if (!isEmailConfigured()) {
    throw new Error("Email delivery is not configured");
  }

  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const verificationUrl = new URL("/verify-account", clientUrl);
  verificationUrl.searchParams.set("email", to);
  const safeName = String(name || "there").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

  const transporter = createTransporter();
  await transporter.sendMail({
    from: mailFrom(),
    to,
    subject: "Verify your Keiyian ERP account",
    text: [
      `Hello ${name || "there"},`,
      "",
      "Your Keiyian ERP account is ready to activate.",
      `Verification code: ${code}`,
      "This code expires in 10 minutes and can only be used once.",
      "",
      `Complete account verification: ${verificationUrl.toString()}`,
      "If you did not expect this invitation, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #19271f; max-width: 560px; margin: 0 auto;">
        <div style="height: 5px; background: #d97706;"></div>
        <div style="padding: 32px 24px; background: #fbfaf5;">
          <p style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #92400e; text-transform: uppercase;">Keiyian ERP &amp; HMIS</p>
          <h1 style="font-size: 24px; margin: 24px 0 12px;">Verify your account</h1>
          <p>Hello ${safeName},</p>
          <p>Your Keiyian ERP account is ready to activate. Enter this code to verify your email and set your password:</p>
          <p style="font-size: 30px; font-weight: 700; letter-spacing: 8px; padding: 16px; background: #fff; border: 1px solid #e2e8f0; text-align: center;">${code}</p>
          <p style="font-size: 13px; color: #64748b;">The code expires in 10 minutes and can only be used once.</p>
          <p><a href="${verificationUrl.toString()}" style="color: #92400e; font-weight: 700;">Open account verification</a></p>
          <p style="font-size: 12px; color: #64748b; margin-top: 28px;">If you did not expect this invitation, you can ignore this email.</p>
        </div>
      </div>
    `,
  });
};
