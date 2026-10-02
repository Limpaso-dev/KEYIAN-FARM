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
  placePurchaseOrder,
} from "../controllers/procurement.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";
import { listGoodsReceipts, receivePurchaseOrder } from "../controllers/receipt.controller.js";
import { listSupplierInvoices, submitSupplierInvoice } from "../controllers/invoice.controller.js";

const router = express.Router();

router.use(protect);

// Suppliers
router.post("/suppliers", authorizeModule("procurement"), createSupplier);
router.get("/suppliers", authorizeModule("suppliers"), getSuppliers);
router.get("/suppliers/:id", authorizeModule("suppliers"), getSupplierById);
router.put("/suppliers/:id", authorizeModule("procurement"), updateSupplier);
router.delete("/suppliers/:id", authorizeModule("procurement"), deleteSupplier);

// Purchase Orders
router.post(
  "/purchase-orders",
  authorizeModule("procurement"),
  createPurchaseOrder
);

router.get(
  "/purchase-orders",
  authorizeModule("procurement"),
  getPurchaseOrders
);

router.get(
  "/purchase-orders/:id",
  authorizeModule("procurement"),
  getPurchaseOrderById
);

router.put(
  "/purchase-orders/:id",
  authorizeModule("procurement"),
  updatePurchaseOrder
);
router.post("/purchase-orders/:id/place", authorizeModule("procurement"), placePurchaseOrder);

router.delete(
  "/purchase-orders/:id",
  authorizeModule("procurement"),
  deletePurchaseOrder
);

router.get("/goods-receipts", authorizeModule("inventory"), listGoodsReceipts);
router.post("/purchase-orders/:orderId/receive", authorizeModule("inventory"), receivePurchaseOrder);
router.get("/supplier-invoices", authorizeModule("procurement"), listSupplierInvoices);
router.post("/supplier-invoices", authorizeModule("procurement"), submitSupplierInvoice);

export default router;
