import mongoose from "mongoose";

const supplierInvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
  goodsReceipt: { type: mongoose.Schema.Types.ObjectId, ref: "GoodsReceipt", required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  department: { type: String, required: true, trim: true },
  invoiceDate: { type: Date, default: Date.now },
  supportingDocumentUrl: { type: String, trim: true },
  items: [{ description: String, quantity: Number, unitPrice: Number, total: Number }],
  totalAmount: { type: Number, required: true, min: 0 },
  matchStatus: { type: String, enum: ["matched", "discrepancy"], required: true },
  discrepancies: [String],
  status: { type: String, enum: ["pending_approval", "approved", "rejected", "returned", "partially_paid", "paid"], default: "pending_approval" },
  policy: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowPolicy" },
  approvalSteps: [{ label: String, approverRole: String, approverDepartment: String, status: { type: String, default: "pending" }, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, decidedAt: Date, comment: String }],
  currentStep: { type: Number, default: 0 },
  history: [{ action: String, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now }, comment: String, stepLabel: String }],
}, { timestamps: true });

supplierInvoiceSchema.index({ supplier: 1, invoiceNumber: 1 }, { unique: true });
export default mongoose.model("SupplierInvoice", supplierInvoiceSchema);
