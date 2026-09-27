import mongoose from "mongoose";

const animalFeedSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    feedType: String,

    unit: {
      type: String,
      required: true,
    },

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

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
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

export default mongoose.model("AnimalFeed", animalFeedSchema);