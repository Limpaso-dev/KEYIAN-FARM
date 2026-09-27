import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    itemCode: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    category: String,

    unit: String,

    quantity: {
      type: Number,
      default: 0,
    },

    reorderLevel: {
      type: Number,
      default: 0,
    },

    unitCost: {
      type: Number,
      default: 0,
    },

    location: String,

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

export default mongoose.model("Inventory", inventorySchema);