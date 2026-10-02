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
      let inventoryItem = null;
      if (acceptedQuantity > 0) {
        if (!submitted.inventoryItem) return res.status(400).json({ success: false, message: `Select an inventory item for accepted ${order.items[index].description}` });
        inventoryItem = await Inventory.findById(submitted.inventoryItem);
        if (!inventoryItem) return res.status(404).json({ success: false, message: "Selected inventory item was not found" });
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
    for (const line of items) {
      if (line.inventoryItem && line.acceptedQuantity > 0) {
        await Inventory.updateOne({ _id: line.inventoryItem }, { $inc: { quantity: line.acceptedQuantity }, $set: { unitCost: order.items[line.poItemIndex].unitPrice } });
      }
    }
    const acceptedTotals = order.items.map((_, index) => previousReceipts.reduce((sum, oldReceipt) => sum + Number(oldReceipt.items.find((line) => line.poItemIndex === index)?.acceptedQuantity || 0), 0) + items[index].acceptedQuantity);
    order.receivedQuantities = acceptedTotals.map((quantity, index) => ({ description: order.items[index].description, acceptedQuantity: quantity }));
    order.status = acceptedTotals.every((quantity, index) => quantity >= order.items[index].quantity) ? "received" : "partially_received";
    await order.save();
    await receipt.populate([{ path: "purchaseOrder", select: "poNumber department" }, { path: "supplier", select: "name supplierCode" }, { path: "items.inventoryItem", select: "name itemCode unit" }, { path: "receivedBy", select: "name" }]);
    res.status(201).json({ success: true, message: "Goods receipt recorded and accepted quantities added to inventory", data: receipt });
  } catch (error) { next(error); }
};
