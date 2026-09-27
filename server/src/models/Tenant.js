import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    phone: String,

    email: String,

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },

    unitNumber: String,

    leaseStart: Date,

    leaseEnd: Date,

    monthlyRent: Number,

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Tenant", tenantSchema);