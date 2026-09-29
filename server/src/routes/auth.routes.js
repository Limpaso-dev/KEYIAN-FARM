import express from "express";

import {
  login,
  getMe,
  createUser,
  getUsers,
  updateUser,
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

export default router;