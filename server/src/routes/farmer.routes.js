import express from "express";

import {
  createFarmer,
  getFarmers,
  getFarmerById,
  updateFarmer,
  deleteFarmer,
} from "../controllers/farmer.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";

const router = express.Router();

/*
 * All farmer routes require authentication.
 */

router.use(protect, authorizeModule("farmers"));

router.get("/", getFarmers);
router.get("/:id", getFarmerById);
router.post("/", createFarmer);
router.put("/:id", updateFarmer);
router.delete("/:id", deleteFarmer);

export default router;