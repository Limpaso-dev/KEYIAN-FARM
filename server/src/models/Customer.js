import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    customerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    address: {
      type: String,
      trim: true,
    },

    taxNumber: {
      type: String,
      trim: true,
    },

    customerType: {
      type: String,
      enum: [
        "individual",
        "business",
        "institution",
        "other",
      ],
      default: "individual",
    },

    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

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

export default mongoose.model(
  "Customer",
  customerSchema
);