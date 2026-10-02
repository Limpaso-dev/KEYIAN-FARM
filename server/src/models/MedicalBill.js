import mongoose from "mongoose";

const medicalBillSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  visit: { type: mongoose.Schema.Types.ObjectId, ref: "MedicalVisit", required: true },
  department: { type: String, default: "hmis" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [{ description: { type: String, required: true }, quantity: { type: Number, required: true, min: 0.01 }, unitPrice: { type: Number, required: true, min: 0 }, total: { type: Number, required: true, min: 0 } }],
  totalAmount: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, default: 0 },
  status: { type: String, enum: ["pending_approval", "approved", "rejected", "returned", "partially_paid", "paid"], default: "pending_approval" },
  policy: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowPolicy" },
  approvalSteps: [{ label: String, approverRole: String, approverDepartment: String, status: { type: String, default: "pending" }, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, decidedAt: Date, comment: String }],
  currentStep: { type: Number, default: 0 },
  history: [{ action: String, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now }, comment: String, stepLabel: String }],
  payments: [{ amount: Number, method: String, reference: String, account: { type: mongoose.Schema.Types.ObjectId, ref: "Account" }, receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, receivedAt: { type: Date, default: Date.now }, transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" } }],
}, { timestamps: true });

export default mongoose.model("MedicalBill", medicalBillSchema);
