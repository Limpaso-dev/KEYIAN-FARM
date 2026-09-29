import express from "express";

import {
  downloadFarmersReport,
  downloadSalesReport,
  getFarmersReport,
  getSalesReport,
} from "../controllers/reports.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/farmers/pdf", authorizeModule("farmers"), downloadFarmersReport);
router.get("/farmers", authorizeModule("farmers"), getFarmersReport);
router.get("/sales/pdf", authorizeModule("salesReports"), downloadSalesReport);
router.get("/sales", authorizeModule("salesReports"), getSalesReport);

export default router;