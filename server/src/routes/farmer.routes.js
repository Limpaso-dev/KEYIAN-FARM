import express from "express";

import {
  createFarmer,
  getFarmers,
  getFarmerById,
  updateFarmer,
  deleteFarmer,
} from "../controllers/farmer.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

/*
 * All farmer routes require authentication.
 */

// Get all farmers
router.get("/", protect, getFarmers);

// Get a single farmer
router.get("/:id", protect, getFarmerById);

// Create a farmer
router.post("/", protect, createFarmer);

// Update a farmer
router.put("/:id", protect, updateFarmer);

// Delete a farmer
router.delete("/:id", protect, deleteFarmer);

export default router;