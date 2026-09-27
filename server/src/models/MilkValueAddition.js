import mongoose from "mongoose";

const milkValueAdditionSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
    },

    batchNumber: {
      type: String,
      required: true,
      unique: true,
    },

    inputMilkLitres: {
      type: Number,
      required: true,
    },

    outputQuantity: {
      type: Number,
      required: true,
    },

    unit: {
      type: String,
      required: true,
    },

    productionDate: {
      type: Date,
      required: true,
    },

    expiryDate: Date,

    status: {
      type: String,
      enum: ["processing", "completed", "rejected"],
      default: "processing",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "MilkValueAddition",
  milkValueAdditionSchema
);