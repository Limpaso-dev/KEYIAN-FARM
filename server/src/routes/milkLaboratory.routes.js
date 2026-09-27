import express from "express";

import {
  createMilkTest,
  getMilkTests,
  getMilkTestById,
  updateMilkTest,
  deleteMilkTest,
} from "../controllers/milkLaboratory.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createMilkTest);
router.get("/", getMilkTests);
router.get("/:id", getMilkTestById);
router.put("/:id", updateMilkTest);
router.delete("/:id", deleteMilkTest);

export default router;