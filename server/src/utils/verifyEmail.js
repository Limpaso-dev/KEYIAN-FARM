import "dotenv/config";
import { isEmailConfigured, verifyEmailTransport } from "../services/email.service.js";

if (!isEmailConfigured()) {
  console.error("SMTP is not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and MAIL_FROM in server/.env.");
  process.exitCode = 1;
} else {
  try {
    await verifyEmailTransport();
    console.log("SMTP connection verified.");
  } catch (error) {
    console.error(`SMTP verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
