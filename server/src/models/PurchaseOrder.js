import mongoose from "mongoose";

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    purchaseRequest: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest" },
    quotationUrl: { type: String, trim: true },
    department: { type: String, required: true, trim: true },
    policy: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowPolicy" },

    items: [
      {
        description: String,

        quantity: Number,

        unitPrice: Number,

        total: Number,
      },
    ],

    subtotal: Number,

    tax: {
      type: Number,
      default: 0,
    },

    totalAmount: Number,

    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "returned",
        "approved",
        "ordered",
        "partially_received",
        "received",
        "cancelled",
      ],
      default: "draft",
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvalSteps: [{
      label: { type: String, required: true },
      approverRole: { type: String, required: true },
      approverDepartment: String,
      status: { type: String, enum: ["pending", "approved", "rejected", "returned"], default: "pending" },
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      decidedAt: Date,
      comment: String,
    }],
    currentStep: { type: Number, default: 0 },
    history: [{
      action: { type: String, required: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      at: { type: Date, default: Date.now },
      comment: String,
      stepLabel: String,
    }],
    receivedQuantities: [{ description: String, acceptedQuantity: { type: Number, default: 0 } }],

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

purchaseOrderSchema.index({ purchaseRequest: 1 }, { unique: true, sparse: true });

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
