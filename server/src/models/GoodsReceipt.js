import mongoose from "mongoose";

const goodsReceiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, unique: true, required: true },
  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receivedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending_store", "released_to_stores"], default: "pending_store" },
  releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  releasedAt: Date,
  notes: String,
  items: [{
    description: { type: String, required: true },
    orderedQuantity: { type: Number, required: true },
    receivedQuantity: { type: Number, required: true, min: 0 },
    acceptedQuantity: { type: Number, required: true, min: 0 },
    damagedQuantity: { type: Number, required: true, min: 0 },
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
  }],
}, { timestamps: true });

export default mongoose.model("GoodsReceipt", goodsReceiptSchema);
