import mongoose from "mongoose";

const milkCollectionSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
    },

    collectionCentre: {
      type: String,
      required: true,
    },

    collectionDate: {
      type: Date,
      required: true,
    },

    quantityLitres: {
      type: Number,
      required: true,
      min: 0,
    },

    pricePerLitre: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["accepted", "rejected", "partial"],
      default: "accepted",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("MilkCollection", milkCollectionSchema);