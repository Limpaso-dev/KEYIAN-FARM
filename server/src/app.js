import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/auth.routes.js";
import farmerRoutes from "./routes/farmer.routes.js";

import livestockRoutes from "./routes/livestock.routes.js";
import milkValueAdditionRoutes from "./routes/milkValueAddition.routes.js";
import teaRoutes from "./routes/tea.routes.js";
import sugarcaneRoutes from "./routes/sugarcane.routes.js";

import medicalRoutes from "./routes/medical.routes.js";

import rentalRoutes from "./routes/rental.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import financeRoutes from "./routes/finance.routes.js";
import animalFeedsRoutes from "./routes/animalFeeds.routes.js";
import milkCollectionRoutes from "./routes/milkCollection.routes.js";
import milkLaboratoryRoutes from "./routes/milkLaboratory.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import procurementRoutes from "./routes/procurement.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import workflowRoutes from "./routes/workflow.routes.js";

import { errorHandler } from "./middleware/error.middleware.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

/*
 * HEALTH CHECK
 */

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Keiyian ERP API is running",
  });
});

/*
 * API MODULES
 */

// Authentication
app.use("/api/auth", authRoutes);

// Farmers
app.use("/api/farmers", farmerRoutes);

// Livestock & Agriculture
app.use("/api/livestock", livestockRoutes);
app.use(
  "/api/milk-value-addition",
  milkValueAdditionRoutes
);
app.use("/api/tea", teaRoutes);
app.use("/api/sugarcane", sugarcaneRoutes);

// Medical / HMIS
app.use("/api/medical", medicalRoutes);

// Administration & Operations
app.use("/api/rentals", rentalRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/finance", financeRoutes);
app.use(
  "/api/animal-feeds",
  animalFeedsRoutes
);
app.use(
  "/api/milk-collection",
  milkCollectionRoutes
);
app.use(
  "/api/milk-laboratory",
  milkLaboratoryRoutes
);

// Sales & Procurement
app.use("/api/sales", salesRoutes);
app.use(
  "/api/procurement",
  procurementRoutes
);

// Inventory
app.use(
  "/api/inventory",
  inventoryRoutes
);
app.use("/api/reports", reportsRoutes);
app.use("/api/workflows", workflowRoutes);

/*
 * ERROR HANDLER
 */

app.use(errorHandler);

export default app;
