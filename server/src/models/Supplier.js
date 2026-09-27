import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    supplierCode: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    contactPerson: String,

    phone: String,

    email: String,

    address: String,

    taxNumber: String,

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

export default mongoose.model("Supplier", supplierSchema);