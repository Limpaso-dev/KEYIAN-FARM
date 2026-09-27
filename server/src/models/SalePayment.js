import mongoose from "mongoose";

const salePaymentSchema = new mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "mpesa",
        "bank",
        "cheque",
        "other",
      ],
      required: true,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "reversed",
      ],
      default: "confirmed",
    },

    notes: {
      type: String,
      trim: true,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "SalePayment",
  salePaymentSchema
);