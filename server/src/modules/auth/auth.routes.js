import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import prisma from "../../config/prisma.js";
import { permissionsFor } from "../../config/access.js";
import { DEPARTMENT_ROLES, optionValues } from "../../config/catalog.js";
import { adminsOnly, protect, PUBLIC_USER_FIELDS, requirePasswordChanged } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, forbidden, HttpError, notFound, ok } from "../../lib/http.js";
import { isEmailConfigured, sendAccountEmail, sendVerificationEmail } from "../../services/email.service.js";

const router = express.Router();

const MIN_PASSWORD = 10;
const VERIFICATION_EXPIRY_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_DELAY_MS = 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "12h" });
const publicUser = (user) => Object.fromEntries(Object.keys(PUBLIC_USER_FIELDS).map((key) => [key, user[key] ?? null]));
const session = (user) => ({ user: publicUser(user), permissions: permissionsFor(user) });

/** Readable temporary password, e.g. "Kfc-7HQ2-M9XT". */
const temporaryPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const digits = "23456789";
  // Three random characters plus a digit, so the result always passes checkPassword.
  const block = () => Array.from({ length: 3 }, () => alphabet[randomInt(alphabet.length)]).join("") + digits[randomInt(digits.length)];
  return `Kfc-${block()}-${block()}`;
};

const checkPassword = (password) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD} characters`);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw badRequest("Password must contain both letters and numbers");
  }
};

// ---------------------------------------------------------------------
// Login attempt limiting: 8 failures per email+IP in 15 minutes.
// ---------------------------------------------------------------------
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const attemptKey = (req, email) => `${req.ip}|${email}`;
const isLocked = (key) => {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
};
const recordFailure = (key) => {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
};

// ---------------------------------------------------------------------
// Email verification codes (used when an admin changes a user's email)
// ---------------------------------------------------------------------
const hashCode = (userId, code) => createHmac("sha256", process.env.JWT_SECRET).update(`${userId}:${code}`).digest("hex");
const codeMatches = (user, code) => {
  const expected = Buffer.from(user.emailVerificationCodeHash || "", "hex");
  const provided = Buffer.from(hashCode(user.id, code), "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
};
const newVerification = (userId) => {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return {
    code,
    data: {
      emailVerified: false,
      emailVerificationCodeHash: hashCode(userId, code),
      emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_EXPIRY_MS),
      emailVerificationAttempts: 0,
      emailVerificationLastSentAt: new Date(),
    },
  };
};

// =====================================================================
// SESSION
// =====================================================================

router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) throw badRequest("Email and password are required");

  const key = attemptKey(req, email);
  if (isLocked(key)) throw new HttpError(429, "Too many failed sign-in attempts. Try again in 15 minutes.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    recordFailure(key);
    throw new HttpError(401, "Invalid email or password");
  }
  if (!user.isActive) throw forbidden("This account has been deactivated. Contact the system administrator.");
  if (!user.emailVerified) throw forbidden("Verify your email address before signing in.");

  failures.delete(key);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  ok(res, { token: signToken(user.id), ...session(updated) });
});

router.get("/me", protect, (req, res) => ok(res, session(req.user)));

router.post("/change-password", protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(String(currentPassword || ""), user.password))) {
    throw badRequest("Your current password is not correct");
  }
  checkPassword(newPassword);
  if (newPassword === currentPassword) throw badRequest("Choose a password different from the current one");
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(newPassword, 12), mustChangePassword: false },
  });
  await audit(prisma, { user: req.user, action: "change_password", entity: "user", entityId: user.id });
  ok(res, session(updated));
});

router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  if (!isValidEmail(email) || !/^\d{6}$/.test(String(code || ""))) throw badRequest("Enter your email and the six-digit code");
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  const invalid = badRequest("The verification code is invalid or has expired");
  if (!user || user.emailVerified || !user.emailVerificationCodeHash) throw invalid;
  if (user.emailVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) throw new HttpError(429, "Too many incorrect codes. Ask for a new code.");
  if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) throw invalid;
  if (!codeMatches(user, String(code))) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerificationAttempts: { increment: 1 } } });
    throw invalid;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0,
    },
  });
  ok(res, { message: "Email verified. You can now sign in." });
});

router.post("/resend-verification", async (req, res) => {
  if (!isValidEmail(req.body.email)) throw badRequest("Enter a valid email address");
  if (!isEmailConfigured()) throw new HttpError(503, "Email delivery is not set up on this server");
  const user = await prisma.user.findFirst({ where: { email: normalizeEmail(req.body.email), emailVerified: false } });
  if (user && Date.now() - new Date(user.emailVerificationLastSentAt || 0).getTime() >= VERIFICATION_RESEND_DELAY_MS) {
    const { code, data } = newVerification(user.id);
    await prisma.user.update({ where: { id: user.id }, data });
    await sendVerificationEmail({ to: user.email, name: user.name, code }).catch((error) =>
      console.error("Verification email failed:", error.message));
  }
  ok(res, { message: "If an unverified account exists for that email, a new code has been sent." }, 202);
});

// =====================================================================
// USER ACCOUNTS (system administrators)
// =====================================================================

const ROLE_VALUES = optionValues("roles");
const DEPARTMENT_VALUES = optionValues("departments");

/** Validate role/department combination and who may assign it. */
const checkAssignment = (actor, role, department) => {
  if (!ROLE_VALUES.includes(role)) throw badRequest("Choose a valid role");
  if (DEPARTMENT_ROLES.includes(role)) {
    if (!DEPARTMENT_VALUES.includes(department)) throw badRequest("Heads and officers must belong to a department");
  } else if (department) {
    throw badRequest("Only heads and officers belong to a department");
  }
  if (["super_admin", "admin"].includes(role) && actor.role !== "super_admin") {
    throw forbidden("Only a super admin can create or change administrator accounts");
  }
};

const guardTarget = (actor, target) => {
  if (["super_admin", "admin"].includes(target.role) && actor.role !== "super_admin") {
    throw forbidden("Only a super admin can manage administrator accounts");
  }
};

const linkEmployee = async (employeeId, ignoreUserId) => {
  if (!employeeId) return null;
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: true } });
  if (!employee) throw badRequest("The selected staff record does not exist");
  if (employee.user && employee.user.id !== ignoreUserId) throw conflict("That staff member already has a user account");
  return employee;
};

router.get("/users", protect, requirePasswordChanged, adminsOnly, async (req, res) => {
  const users = await prisma.user.findMany({
    where: req.user.role === "super_admin" ? {} : { role: { not: "super_admin" } },
    select: { ...PUBLIC_USER_FIELDS, employee: { select: { id: true, staffNumber: true, firstName: true, lastName: true } } },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });
  ok(res, users);
});

router.post("/users", protect, requirePasswordChanged, adminsOnly, async (req, res) => {
  const { name, phone, role, employeeId } = req.body;
  const email = normalizeEmail(req.body.email);
  const department = req.body.department || null;
  if (!String(name || "").trim()) throw badRequest("Name is required");
  if (!isValidEmail(email)) throw badRequest("Enter a valid email address");
  checkAssignment(req.user, role, department);
  if (await prisma.user.findUnique({ where: { email } })) throw conflict("A user with this email already exists");
  const employee = await linkEmployee(employeeId);
  if (employee && department && employee.department !== department) {
    throw badRequest(`That staff member works in ${employee.department}, not ${department}`);
  }

  const password = req.body.password || temporaryPassword();
  checkPassword(password);
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email,
      phone: phone ? String(phone).trim() : null,
      role,
      department,
      employeeId: employee?.id || null,
      password: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    },
  });
  await audit(prisma, { user: req.user, action: "create", entity: "user", entityId: user.id, after: publicUser(user) });

  let emailed = false;
  if (isEmailConfigured()) {
    emailed = await sendAccountEmail({ to: email, name: user.name, password })
      .then(() => true)
      .catch((error) => {
        console.error("Account email failed:", error.message);
        return false;
      });
  }
  ok(res, { user: publicUser(user), temporaryPassword: password, emailed }, 201);
});

router.put("/users/:id", protect, requirePasswordChanged, adminsOnly, async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound("User");
  guardTarget(req.user, target);
  const isSelf = target.id === req.user.id;

  const data = {};
  if (req.body.name !== undefined) {
    if (!String(req.body.name).trim()) throw badRequest("Name cannot be empty");
    data.name = String(req.body.name).trim();
  }
  if (req.body.phone !== undefined) data.phone = req.body.phone ? String(req.body.phone).trim() : null;

  const role = req.body.role ?? target.role;
  const department = req.body.department !== undefined ? req.body.department || null : target.department;
  if (req.body.role !== undefined || req.body.department !== undefined) {
    if (isSelf && role !== target.role) throw badRequest("You cannot change your own role");
    checkAssignment(req.user, role, DEPARTMENT_ROLES.includes(role) ? department : null);
    data.role = role;
    data.department = DEPARTMENT_ROLES.includes(role) ? department : null;
  }
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== "boolean") throw badRequest("isActive must be true or false");
    if (isSelf && !req.body.isActive) throw badRequest("You cannot deactivate your own account");
    data.isActive = req.body.isActive;
  }
  if (req.body.employeeId !== undefined) {
    const employee = await linkEmployee(req.body.employeeId || null, target.id);
    data.employeeId = employee?.id || null;
  }

  let verification = null;
  if (req.body.email !== undefined && normalizeEmail(req.body.email) !== target.email) {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) throw badRequest("Enter a valid email address");
    if (await prisma.user.findUnique({ where: { email } })) throw conflict("A user with this email already exists");
    data.email = email;
    if (isEmailConfigured()) {
      verification = newVerification(target.id);
      Object.assign(data, verification.data);
    }
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data });
  await audit(prisma, { user: req.user, action: "update", entity: "user", entityId: target.id, before: publicUser(target), after: publicUser(updated) });
  if (verification) {
    await sendVerificationEmail({ to: updated.email, name: updated.name, code: verification.code }).catch((error) =>
      console.error("Verification email failed:", error.message));
  }
  ok(res, { user: publicUser(updated), verificationSent: Boolean(verification) });
});

router.post("/users/:id/reset-password", protect, requirePasswordChanged, adminsOnly, async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound("User");
  guardTarget(req.user, target);
  const password = temporaryPassword();
  await prisma.user.update({
    where: { id: target.id },
    data: { password: await bcrypt.hash(password, 12), mustChangePassword: true },
  });
  await audit(prisma, { user: req.user, action: "reset_password", entity: "user", entityId: target.id });
  ok(res, { temporaryPassword: password });
});

export default router;
