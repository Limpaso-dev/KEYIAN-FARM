import express from "express";

import {
  createInventory,
  getInventory,
  getInventoryById,
  updateInventory,
  deleteInventory,
} from "../controllers/inventory.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

// Inventory
router.post("/", createInventory);
router.get("/", getInventory);
router.get("/:id", getInventoryById);
router.put("/:id", updateInventory);
router.delete("/:id", deleteInventory);

export default router;