import express from "express";

import {
  createTeaFarm,
  getTeaFarms,
  getTeaFarmById,
  updateTeaFarm,
  deleteTeaFarm,
} from "../controllers/tea.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(protect, authorizeModule("tea"));

router.post("/", createTeaFarm);
router.get("/", getTeaFarms);
router.get("/:id", getTeaFarmById);
router.put("/:id", updateTeaFarm);
router.delete("/:id", deleteTeaFarm);

export default router;