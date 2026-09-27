import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    category: String,

    sku: {
      type: String,
      unique: true,
      sparse: true,
    },

    unit: String,

    sellingPrice: Number,

    stockQuantity: {
      type: Number,
      default: 0,
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

export default mongoose.model("Product", productSchema);