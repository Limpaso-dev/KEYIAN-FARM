import express from "express";
import cors from "cors";
import helmet from "helmet";

import { protect, requirePasswordChanged } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { HttpError } from "./lib/http.js";

import authRoutes from "./modules/auth/auth.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import hrRoutes from "./modules/hr/hr.routes.js";
import livestockRoutes from "./modules/livestock/livestock.routes.js";
import mvaRoutes from "./modules/mva/mva.routes.js";
import salesRoutes from "./modules/sales/sales.routes.js";
import stockRoutes from "./modules/stock/stock.routes.js";
import storesRoutes from "./modules/stores/stores.routes.js";
import cropsRoutes from "./modules/crops/crops.routes.js";
import accountsRoutes from "./modules/accounts/accounts.routes.js";
import requisitionRoutes from "./modules/requisitions/requisitions.routes.js";
import reportRoutes from "./modules/reports/reports.routes.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
// Content-Disposition carries the file name of report downloads.
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true, exposedHeaders: ["Content-Disposition"] }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ success: true, message: "Keiyian ERP API is running" }));

// Public sign-in, then everything below needs a session.
app.use("/api/auth", authRoutes);

const secured = express.Router();
secured.use(protect, requirePasswordChanged);
secured.use("/", dashboardRoutes);
secured.use("/hr", hrRoutes);
secured.use("/livestock", livestockRoutes);
secured.use("/mva", mvaRoutes);
secured.use("/sales", salesRoutes);
secured.use("/stock", stockRoutes);
secured.use("/stores", storesRoutes);
secured.use("/crops", cropsRoutes);
secured.use("/accounts", accountsRoutes);
secured.use("/requisitions", requisitionRoutes);
secured.use("/reports", reportRoutes);
app.use("/api", secured);

app.use("/api", (req, res, next) => next(new HttpError(404, `No API route for ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);

export default app;
