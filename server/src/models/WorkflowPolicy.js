import mongoose from "mongoose";

const workflowPolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    workflowType: { type: String, enum: ["purchase_request", "purchase_order", "supplier_invoice", "supplier_payment", "hmis_bill", "finance_transaction"], default: "purchase_request" },
    department: { type: String, required: true, trim: true, lowercase: true },
    minAmount: { type: Number, default: 0, min: 0 },
    maxAmount: { type: Number, default: null, min: 0 },
    steps: [{
      label: { type: String, required: true, trim: true },
      approverRole: { type: String, required: true, enum: ["manager", "finance", "procurement", "doctor", "nurse", "admin", "super_admin"] },
    }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

workflowPolicySchema.index({ workflowType: 1, department: 1, minAmount: 1, maxAmount: 1 }, { unique: true });

export default mongoose.model("WorkflowPolicy", workflowPolicySchema);
