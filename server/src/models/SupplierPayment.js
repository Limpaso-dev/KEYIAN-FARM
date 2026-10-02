import mongoose from "mongoose";

const supplierPaymentSchema = new mongoose.Schema({
  paymentNumber: { type: String, required: true, unique: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierInvoice", required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ["bank_transfer", "cash", "cheque", "mobile_money", "other"], required: true },
  reference: { type: String, required: true },
  paymentDate: { type: Date, default: Date.now },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending_approval", "approved", "rejected", "returned"], default: "pending_approval" },
  policy: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowPolicy" },
  approvalSteps: [{ label: String, approverRole: String, approverDepartment: String, status: { type: String, default: "pending" }, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, decidedAt: Date, comment: String }],
  currentStep: { type: Number, default: 0 },
  history: [{ action: String, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now }, comment: String, stepLabel: String }],
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
}, { timestamps: true });

export default mongoose.model("SupplierPayment", supplierPaymentSchema);
