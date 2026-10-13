import express from "express";

import {
  createInventory,
  getInventory,
  getInventoryById,
  updateInventory,
  deleteInventory,
} from "../controllers/inventory.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { authorizeModule } from "../middleware/role.middleware.js";
import { listGoodsReceipts, receivePurchaseOrder, releaseReceiptToStores } from "../controllers/receipt.controller.js";
import { getPurchaseOrders } from "../controllers/procurement.controller.js";

const router = express.Router();

router.use(protect);

router.get("/receiving/purchase-orders", authorizeModule("receiving"), getPurchaseOrders);
router.get("/goods-receipts", authorizeModule("receiving"), listGoodsReceipts);
router.post("/receiving/purchase-orders/:orderId", (req, res, next) => req.user?.role === "procurement" || ["admin", "super_admin"].includes(req.user?.role) ? next() : res.status(403).json({ success: false, message: "Only procurement can verify supplier deliveries" }), receivePurchaseOrder);
router.post("/goods-receipts/:id/release", (req, res, next) => req.user?.role === "stores" || ["admin", "super_admin"].includes(req.user?.role) ? next() : res.status(403).json({ success: false, message: "Only stores can release accepted goods into inventory" }), releaseReceiptToStores);

// Inventory
router.post("/", authorizeModule("inventory"), createInventory);
router.get("/", authorizeModule("inventory"), getInventory);
router.get("/:id", authorizeModule("inventory"), getInventoryById);
router.put("/:id", authorizeModule("inventory"), updateInventory);
router.delete("/:id", authorizeModule("inventory"), deleteInventory);

export default router;
