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
        "submitted",
        "approved",
        "ordered",
        "received",
        "cancelled",
      ],
      default: "draft",
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);