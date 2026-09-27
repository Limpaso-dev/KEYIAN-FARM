import express from "express";

import {
  createSugarcaneFarm,
  getSugarcaneFarms,
  getSugarcaneFarmById,
  updateSugarcaneFarm,
  deleteSugarcaneFarm,
} from "../controllers/sugarcane.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createSugarcaneFarm);
router.get("/", getSugarcaneFarms);
router.get("/:id", getSugarcaneFarmById);
router.put("/:id", updateSugarcaneFarm);
router.delete("/:id", deleteSugarcaneFarm);

export default router;