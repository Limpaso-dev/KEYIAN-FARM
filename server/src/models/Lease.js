import mongoose from "mongoose";

const leaseSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
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

    leaseStart: {
      type: Date,
      required: true,
    },

    leaseEnd: {
      type: Date,
      required: true,
    },

    monthlyRent: {
      type: Number,
      required: true,
      min: 0,
    },

    securityDeposit: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentDueDay: {
      type: Number,
      default: 5,
      min: 1,
      max: 31,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "active",
        "expired",
        "terminated",
      ],
      default: "draft",
    },

    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Lease", leaseSchema);