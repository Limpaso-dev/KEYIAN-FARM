import express from "express";

import {
  createLivestock,
  getLivestock,
  getLivestockById,
  updateLivestock,
  deleteLivestock,
} from "../controllers/livestock.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";

const router = express.Router();

// All livestock routes require authentication
router.use(protect, authorizeModule("livestock"));

// Create
router.post("/", createLivestock);

// Get all
router.get("/", getLivestock);

// Get one
router.get("/:id", getLivestockById);

// Update
router.put("/:id", updateLivestock);

// Delete
router.delete("/:id", deleteLivestock);

export default router;