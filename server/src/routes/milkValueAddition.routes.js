import express from "express";

import {
  createMilkValueAddition,
  getMilkValueAdditions,
  getMilkValueAdditionById,
  updateMilkValueAddition,
  deleteMilkValueAddition,
} from "../controllers/milkValueAddition.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(protect, authorizeModule("milkValueAddition"));

router.post("/", createMilkValueAddition);
router.get("/", getMilkValueAdditions);
router.get("/:id", getMilkValueAdditionById);
router.put("/:id", updateMilkValueAddition);
router.delete("/:id", deleteMilkValueAddition);

export default router;