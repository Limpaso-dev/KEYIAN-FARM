import mongoose from "mongoose";

const sugarcaneFarmSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
    },

    farmName: String,

    location: String,

    acreage: {
      type: Number,
      required: true,
    },

    variety: String,

    plantingDate: Date,

    expectedHarvestDate: Date,

    harvestRecords: [
      {
        harvestDate: Date,
        quantityTonnes: Number,
      },
    ],

    status: {
      type: String,
      enum: ["active", "harvested", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("SugarcaneFarm", sugarcaneFarmSchema);