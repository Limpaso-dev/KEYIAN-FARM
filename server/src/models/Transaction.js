import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },

    transactionDate: {
      type: Date,
      default: Date.now,
    },

    type: {
      type: String,
      enum: [
        "income",
        "expense",
        "payment",
        "receipt",
        "transfer",
        "journal",
      ],
      required: true,
    },

    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    description: String,

    status: {
      type: String,
      enum: ["pending", "approved", "posted", "cancelled", "rejected", "returned"],
      default: "pending",
    },

    department: { type: String, default: "finance" },
    policy: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowPolicy" },
    approvalSteps: [{ label: String, approverRole: String, approverDepartment: String, status: { type: String, default: "pending" }, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, decidedAt: Date, comment: String }],
    currentStep: { type: Number, default: 0 },
    history: [{ action: String, by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now }, comment: String, stepLabel: String }],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Transaction", transactionSchema);
