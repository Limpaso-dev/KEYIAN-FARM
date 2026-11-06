import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { can, canManageUsers } from "../config/access.js";
import { forbidden, HttpError } from "../lib/http.js";

const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  department: true,
  employeeId: true,
  isActive: true,
  mustChangePassword: true,
  emailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

export { PUBLIC_USER_FIELDS };

/** Require a valid bearer token for an active user; sets req.user. */
export const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new HttpError(401, "Authentication required"));

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return next(new HttpError(401, "Your session has expired. Please sign in again."));
  }

  const user = typeof decoded.id === "string"
    ? await prisma.user.findUnique({ where: { id: decoded.id }, select: PUBLIC_USER_FIELDS })
    : null;
  if (!user || !user.isActive) return next(new HttpError(401, "Your account is not active"));

  req.user = user;
  return next();
};

/**
 * Block users who still have a temporary password from everything except
 * reading their profile and changing the password.
 */
export const requirePasswordChanged = (req, res, next) =>
  req.user?.mustChangePassword
    ? next(new HttpError(428, "Change your temporary password before continuing"))
    : next();

/** Check a permission from config/access.js. */
export const allow = (resource, action) => (req, res, next) => {
  const resolved = action || (["GET", "HEAD"].includes(req.method) ? "read" : req.method === "DELETE" ? "delete" : "write");
  return can(req.user, resource, resolved) ? next() : next(forbidden());
};

export const adminsOnly = (req, res, next) =>
  canManageUsers(req.user) ? next() : next(forbidden("Only system administrators can manage user accounts"));
