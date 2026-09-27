import express from "express";

import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,

  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from "../controllers/procurement.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

// Suppliers
router.post("/suppliers", createSupplier);
router.get("/suppliers", getSuppliers);
router.get("/suppliers/:id", getSupplierById);
router.put("/suppliers/:id", updateSupplier);
router.delete("/suppliers/:id", deleteSupplier);

// Purchase Orders
router.post(
  "/purchase-orders",
  createPurchaseOrder
);

router.get(
  "/purchase-orders",
  getPurchaseOrders
);

router.get(
  "/purchase-orders/:id",
  getPurchaseOrderById
);

router.put(
  "/purchase-orders/:id",
  updatePurchaseOrder
);

router.delete(
  "/purchase-orders/:id",
  deletePurchaseOrder
);

export default router;