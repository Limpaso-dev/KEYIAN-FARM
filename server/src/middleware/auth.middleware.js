import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

export const protect = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const token = header.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  try {
    const userRecord = typeof decoded.id === "string"
      ? await prisma.user.findUnique({ where: { id: decoded.id } })
      : null;

    if (!userRecord || !userRecord.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid user",
      });
    }

    const {
      password,
      emailVerificationCodeHash,
      emailVerificationExpiresAt,
      emailVerificationAttempts,
      emailVerificationLastSentAt,
      ...user
    } = userRecord;
    req.user = { ...user, _id: user.id };
    return next();
  } catch (error) {
    return next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action",
      });
    }

    next();
  };
};