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
import { listGoodsReceipts, receivePurchaseOrder } from "../controllers/receipt.controller.js";
import { getPurchaseOrders } from "../controllers/procurement.controller.js";

const router = express.Router();

router.use(protect);

router.get("/receiving/purchase-orders", authorizeModule("receiving"), getPurchaseOrders);
router.get("/goods-receipts", authorizeModule("receiving"), listGoodsReceipts);
router.post("/receiving/purchase-orders/:orderId", authorizeModule("receiving"), receivePurchaseOrder);

// Inventory
router.post("/", authorizeModule("inventory"), createInventory);
router.get("/", authorizeModule("inventory"), getInventory);
router.get("/:id", authorizeModule("inventory"), getInventoryById);
router.put("/:id", authorizeModule("inventory"), updateInventory);
router.delete("/:id", authorizeModule("inventory"), deleteInventory);

export default router;
