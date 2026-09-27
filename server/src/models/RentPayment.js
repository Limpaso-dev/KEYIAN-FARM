import mongoose from "mongoose";

const rentPaymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },

    lease: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lease",
      required: true,
    },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },

    unitNumber: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
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

    period: {
      type: String,
      required: true,
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
  "RentPayment",
  rentPaymentSchema
);