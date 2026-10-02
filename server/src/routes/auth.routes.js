import express from "express";

import {
  login,
  getMe,
  createUser,
  getUsers,
  updateUser,
  verifyUserEmail,
  requestVerificationCode,
  resendUserVerification,
} from "../controllers/auth.controller.js";

import {
  protect,
  authorize,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/*
 * AUTHENTICATION
 */

// Login
router.post("/login", login);
router.post("/verify-email", verifyUserEmail);
router.post("/resend-verification", requestVerificationCode);

// Get currently authenticated user
router.get("/me", protect, getMe);

/*
 * USER MANAGEMENT
 */

// Create system user
router.post(
  "/users",
  protect,
  authorize("admin", "super_admin"),
  createUser
);

router.get(
  "/users",
  protect,
  authorize("admin", "super_admin"),
  getUsers
);

router.put(
  "/users/:id",
  protect,
  authorize("admin", "super_admin"),
  updateUser
);

router.post(
  "/users/:id/resend-verification",
  protect,
  authorize("admin", "super_admin"),
  resendUserVerification
);

export default router;