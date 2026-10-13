import { randomInt } from "node:crypto";
import GoodsReceipt from "../models/GoodsReceipt.js";
import Inventory from "../models/Inventory.js";
import PurchaseOrder from "../models/PurchaseOrder.js";

export const listGoodsReceipts = async (req, res, next) => {
  try {
    const receipts = await GoodsReceipt.find()
      .populate("purchaseOrder", "poNumber department")
      .populate("supplier", "name supplierCode")
      .populate("receivedBy", "name")
      .populate("items.inventoryItem", "name itemCode unit")
      .sort({ receivedAt: -1 });
    res.json({ success: true, count: receipts.length, data: receipts });
  } catch (error) { next(error); }
};

export const receivePurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (!["ordered", "partially_received"].includes(order.status)) {
      return res.status(409).json({ success: false, message: "The purchase order must be approved and placed with the supplier before receiving" });
    }
    if (!Array.isArray(req.body.items) || req.body.items.length !== order.items.length) {
      return res.status(400).json({ success: false, message: "Provide receiving quantities for every purchase order line" });
    }

    const previousReceipts = await GoodsReceipt.find({ purchaseOrder: order._id });
    const receivedSoFar = order.items.map((_, index) => previousReceipts.reduce((sum, receipt) => {
      const line = receipt.items.find((item) => item.poItemIndex === index);
      return sum + Number(line?.receivedQuantity || 0);
    }, 0));

    const items = [];
    for (let index = 0; index < order.items.length; index += 1) {
      const submitted = req.body.items[index];
      const receivedQuantity = Number(submitted.receivedQuantity);
      const acceptedQuantity = Number(submitted.acceptedQuantity);
      const damagedQuantity = Number(submitted.damagedQuantity || 0);
      const remaining = order.items[index].quantity - receivedSoFar[index];
      if (![receivedQuantity, acceptedQuantity, damagedQuantity].every(Number.isFinite) || receivedQuantity < 0 || acceptedQuantity < 0 || damagedQuantity < 0 || Math.abs(receivedQuantity - acceptedQuantity - damagedQuantity) > 0.0001 || receivedQuantity > remaining) {
        return res.status(400).json({ success: false, message: `Invalid or over-received quantity for ${order.items[index].description}. Remaining to receive: ${remaining}` });
      }
      items.push({
        poItemIndex: index,
        description: order.items[index].description,
        orderedQuantity: order.items[index].quantity,
        receivedQuantity,
        acceptedQuantity,
        damagedQuantity,
        inventoryItem: inventoryItem?._id,
      });
    }

    const receipt = await GoodsReceipt.create({
      receiptNumber: `GRN-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}-${randomInt(100, 1000)}`,
      purchaseOrder: order._id,
      supplier: order.supplier,
      receivedBy: req.user._id,
      notes: String(req.body.notes || "").trim(),
      items,
    });
    const acceptedTotals = order.items.map((_, index) => previousReceipts.reduce((sum, oldReceipt) => sum + Number(oldReceipt.items.find((line) => line.poItemIndex === index)?.acceptedQuantity || 0), 0) + items[index].acceptedQuantity);
    order.receivedQuantities = acceptedTotals.map((quantity, index) => ({ description: order.items[index].description, acceptedQuantity: quantity }));
    order.status = acceptedTotals.every((quantity, index) => quantity >= order.items[index].quantity) ? "received" : "partially_received";
    await order.save();
    await receipt.populate([{ path: "purchaseOrder", select: "poNumber department" }, { path: "supplier", select: "name supplierCode" }, { path: "items.inventoryItem", select: "name itemCode unit" }, { path: "receivedBy", select: "name" }]);
    res.status(201).json({ success: true, message: "Delivery checked against the purchase order and sent to stores for stock entry", data: receipt });
  } catch (error) { next(error); }
};

export const releaseReceiptToStores = async (req, res, next) => {
  try {
    const receipt = await GoodsReceipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: "Goods receipt not found" });
    if (receipt.status !== "pending_store") return res.status(409).json({ success: false, message: "This receipt has already been released to stores" });
    const order = await PurchaseOrder.findById(receipt.purchaseOrder);
    if (!Array.isArray(req.body.items) || req.body.items.length !== receipt.items.length) return res.status(400).json({ success: false, message: "Select a stock item for each accepted receipt line" });
    const selectedInventory = [];
    for (let index = 0; index < receipt.items.length; index += 1) {
      const line = receipt.items[index];
      if (!line.acceptedQuantity) continue;
      const inventoryItem = await Inventory.findById(req.body.items[index]?.inventoryItem);
      if (!inventoryItem) return res.status(400).json({ success: false, message: `Select a valid inventory item for ${line.description}` });
      line.inventoryItem = inventoryItem._id;
      selectedInventory.push({ inventoryItem, line });
    }
    for (const { inventoryItem, line } of selectedInventory) await Inventory.updateOne({ _id: inventoryItem._id }, { $inc: { quantity: line.acceptedQuantity }, $set: { unitCost: order.items[line.poItemIndex].unitPrice } });
    receipt.status = "released_to_stores";
    receipt.releasedBy = req.user._id;
    receipt.releasedAt = new Date();
    await receipt.save();
    res.json({ success: true, message: "Accepted goods released and inventory updated by stores", data: receipt });
  } catch (error) { next(error); }
};
