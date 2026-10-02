import mongoose from "mongoose";

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true },
    department: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    items: [{
      description: { type: String, required: true, trim: true },
      quantity: { type: Number, required: true, min: 0.01 },
      unitPrice: { type: Number, required: true, min: 0 },
      total: { type: Number, required: true, min: 0 },
    }],
    totalAmount: { type: Number, required: true, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending_approval", "returned", "approved", "rejected", "converted"], default: "pending_approval" },
    policy: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowPolicy", required: true },
    approvalSteps: [{
      label: { type: String, required: true },
      approverRole: { type: String, required: true },
      approverDepartment: { type: String, trim: true },
      status: { type: String, enum: ["pending", "approved", "rejected", "returned"], default: "pending" },
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      decidedAt: Date,
      comment: { type: String, trim: true },
    }],
    currentStep: { type: Number, default: 0 },
    history: [{
      action: { type: String, enum: ["submitted", "resubmitted", "approved", "rejected", "returned", "converted_to_po"], required: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      at: { type: Date, default: Date.now },
      comment: { type: String, trim: true },
      stepLabel: String,
    }],
  },
  { timestamps: true }
);

export default mongoose.model("PurchaseRequest", purchaseRequestSchema);
