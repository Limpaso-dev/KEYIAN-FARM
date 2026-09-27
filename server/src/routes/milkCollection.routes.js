import express from "express";

import {
  createMilkCollection,
  getMilkCollections,
  getMilkCollectionById,
  updateMilkCollection,
  deleteMilkCollection,
} from "../controllers/milkCollection.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// All milk collection routes require authentication
router.use(protect);

// Create
router.post("/", createMilkCollection);

// Get all
router.get("/", getMilkCollections);

// Get one
router.get("/:id", getMilkCollectionById);

// Update
router.put("/:id", updateMilkCollection);

// Delete
router.delete("/:id", deleteMilkCollection);

export default router;