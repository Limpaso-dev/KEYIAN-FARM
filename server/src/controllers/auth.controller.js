import bcrypt from "bcryptjs";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
  isEmailConfigured,
  sendVerificationEmail,
} from "../services/email.service.js";

const VERIFICATION_EXPIRY_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_DELAY_MS = 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const HMIS_ROLE_DEPARTMENTS = {
  receptionist: "reception",
  nurse: "nursing",
  doctor: "medical",
  laboratory: "laboratory",
  pharmacist: "pharmacy",
  cashier: "finance",
  radiology: "radiology",
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const isValidEmail = (email) =>
  typeof email === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const makeVerificationCode = () =>
  String(randomInt(0, 1_000_000)).padStart(6, "0");

const hashVerificationCode = (userId, code) =>
  createHmac("sha256", process.env.JWT_SECRET)
    .update(`${userId}:${code}`)
    .digest("hex");

const setVerificationCode = (user) => {
  const code = makeVerificationCode();
  user.emailVerificationCodeHash = hashVerificationCode(user._id, code);
  user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);
  user.emailVerificationAttempts = 0;
  user.emailVerificationLastSentAt = new Date();
  return code;
};

const codeMatches = (user, code) => {
  const expectedHash = Buffer.from(user.emailVerificationCodeHash || "", "hex");
  const providedHash = Buffer.from(hashVerificationCode(user._id, code), "hex");
  return expectedHash.length === providedHash.length &&
    timingSafeEqual(expectedHash, providedHash);
};

/*
 * Generate JWT
 */
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};

/*
 * Remove sensitive fields before sending
 * user data to the frontend.
 */
const sanitizeUser = (user) => {
  const userObject = user.toObject();

  delete userObject.password;
  delete userObject.emailVerificationCodeHash;
  delete userObject.emailVerificationExpiresAt;
  delete userObject.emailVerificationAttempts;
  delete userObject.emailVerificationLastSentAt;

  return userObject;
};

/*
 * LOGIN
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

/*
 * CURRENT USER
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * CREATE USER
 * POST /api/auth/users
 *
 * Only admins and super admins should be
 * allowed to access this endpoint.
 */
export const createUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      password,
    } = req.body;

    if (["admin", "super_admin"].includes(role) && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only a super admin can create administrator accounts",
      });
    }

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !isValidEmail(email) ||
      typeof password !== "string" ||
      password.length < 12
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid name, email address, and password of at least 12 characters are required",
      });
    }

    const validRoles = User.schema.path("role").enumValues;
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    if (phone !== undefined && typeof phone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone must be a string",
      });
    }

    if (department !== undefined && typeof department !== "string") {
      return res.status(400).json({
        success: false,
        message: "Department must be a string",
      });
    }

    const requiredDepartment = HMIS_ROLE_DEPARTMENTS[role];
    if (requiredDepartment && department?.trim().toLowerCase() && department.trim().toLowerCase() !== requiredDepartment) {
      return res.status(400).json({ success: false, message: `${role} accounts must belong to the ${requiredDepartment} department` });
    }

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim(),
      password: await bcrypt.hash(password, 12),
      role: role || "staff",
      department: requiredDepartment || department?.trim().toLowerCase(),
      isActive: true,
      emailVerified: true,
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: "Account created. The user can sign in with the provided password.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const verifyUserEmail = async (req, res, next) => {
  try {
    const { email, code, password } = req.body;
    if (
      !isValidEmail(email) ||
      typeof code !== "string" ||
      !/^\d{6}$/.test(code) ||
      typeof password !== "string" ||
      password.length < 12
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email, six-digit code, and password of at least 12 characters",
      });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select(
      "+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts"
    );

    if (!user || user.emailVerified || !user.emailVerificationCodeHash) {
      return res.status(400).json({
        success: false,
        message: "The verification code is invalid or expired",
      });
    }

    if (user.emailVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect codes. Request a new verification code.",
      });
    }

    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "The verification code is invalid or expired",
      });
    }

    if (!codeMatches(user, code)) {
      user.emailVerificationAttempts += 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "The verification code is invalid or expired",
      });
    }

    user.password = await bcrypt.hash(password, 12);
    user.emailVerified = true;
    user.set("emailVerificationCodeHash", undefined);
    user.set("emailVerificationExpiresAt", undefined);
    user.set("emailVerificationAttempts", undefined);
    user.set("emailVerificationLastSentAt", undefined);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified. You can now sign in.",
    });
  } catch (error) {
    return next(error);
  }
};

export const requestVerificationCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });
    }

    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Email delivery is currently unavailable",
      });
    }

    const user = await User.findOne({
      email: normalizeEmail(email),
      emailVerified: false,
    }).select("+emailVerificationLastSentAt");

    if (
      user &&
      Date.now() - new Date(user.emailVerificationLastSentAt || 0).getTime() >=
        VERIFICATION_RESEND_DELAY_MS
    ) {
      const code = setVerificationCode(user);
      await user.save();
      try {
        await sendVerificationEmail({ to: user.email, name: user.name, code });
      } catch (error) {
        console.error("Failed to resend user verification email:", error.message);
      }
    }

    return res.status(202).json({
      success: true,
      message: "If an unverified account exists for that email, a new code will be sent.",
    });
  } catch (error) {
    return next(error);
  }
};

export const resendUserVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "+emailVerificationLastSentAt"
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (["admin", "super_admin"].includes(user.role) && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only a super admin can manage administrator accounts",
      });
    }
    if (user.emailVerified) {
      return res.status(409).json({
        success: false,
        message: "This account's email is already verified",
      });
    }
    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Email verification is not configured",
      });
    }

    const elapsed = Date.now() - new Date(user.emailVerificationLastSentAt || 0).getTime();
    if (elapsed < VERIFICATION_RESEND_DELAY_MS) {
      return res.status(429).json({
        success: false,
        message: `Wait ${Math.ceil((VERIFICATION_RESEND_DELAY_MS - elapsed) / 1000)} seconds before resending`,
      });
    }

    const code = setVerificationCode(user);
    await user.save();
    await sendVerificationEmail({ to: user.email, name: user.name, code });

    return res.status(200).json({
      success: true,
      message: `A new verification code was sent to ${user.email}`,
    });
  } catch (error) {
    console.error("Failed to resend user verification email:", error.message);
    return res.status(502).json({
      success: false,
      message: "Unable to send the verification email. Check SMTP settings and try again.",
    });
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const filter = req.user.role === "super_admin"
      ? {}
      : { role: { $ne: "super_admin" } };
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isSelf = user._id.toString() === req.user._id.toString();
    let emailChanged = false;
    if (["admin", "super_admin"].includes(user.role) && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only a super admin can manage administrator accounts",
      });
    }

    if (["admin", "super_admin"].includes(req.body.role) && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only a super admin can assign administrator roles",
      });
    }

    if (
      isSelf &&
      ((req.body.role && req.body.role !== user.role) || req.body.isActive === false)
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role or deactivate your account",
      });
    }

    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      user.name = req.body.name.trim();
    }

    if (req.body.email !== undefined) {
      if (!isValidEmail(req.body.email)) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }
      const email = normalizeEmail(req.body.email);
      const duplicate = await User.findOne({
        email,
        _id: { $ne: user._id },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
      }
      if (email !== user.email) {
        if (!isEmailConfigured()) {
          return res.status(503).json({
            success: false,
            message: "Email verification is not configured. The email address was not changed.",
          });
        }
        emailChanged = true;
        user.email = email;
        user.emailVerified = false;
      }
    }

    if (req.body.phone !== undefined) {
      if (typeof req.body.phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Phone must be a string",
        });
      }
      user.phone = req.body.phone.trim();
    }
    if (req.body.department !== undefined) {
      if (typeof req.body.department !== "string") {
        return res.status(400).json({
          success: false,
          message: "Department must be a string",
        });
      }
      user.department = req.body.department.trim();
    }
    if (req.body.role !== undefined) {
      const validRoles = User.schema.path("role").enumValues;
      if (!validRoles.includes(req.body.role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role",
        });
      }
      user.role = req.body.role;
    }

    const requiredDepartment = HMIS_ROLE_DEPARTMENTS[user.role];
    if (requiredDepartment) {
      if (req.body.department !== undefined && req.body.department.trim().toLowerCase() !== requiredDepartment) {
        return res.status(400).json({ success: false, message: `${user.role} accounts must belong to the ${requiredDepartment} department` });
      }
      user.department = requiredDepartment;
    } else if (req.body.department !== undefined) {
      user.department = req.body.department.trim().toLowerCase();
    }
    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Account status must be a boolean",
        });
      }
      user.isActive = req.body.isActive;
    }

    if (req.body.password) {
      if (
        typeof req.body.password !== "string" ||
        req.body.password.length < 12
      ) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 12 characters",
        });
      }
      user.password = await bcrypt.hash(req.body.password, 12);
    }

    const verificationCode = emailChanged ? setVerificationCode(user) : null;
    await user.save();

    let emailSent = null;
    if (emailChanged) {
      try {
        await sendVerificationEmail({
          to: user.email,
          name: user.name,
          code: verificationCode,
        });
        emailSent = true;
      } catch (emailError) {
        emailSent = false;
        console.error("Failed to send updated email verification:", emailError.message);
      }
    }

    return res.status(200).json({
      success: true,
      emailSent,
      message: emailChanged
        ? emailSent
          ? "Email updated. The user must verify the new address before signing in."
          : "Email updated but verification email could not be sent. Check SMTP settings and resend the code."
        : "User updated successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};