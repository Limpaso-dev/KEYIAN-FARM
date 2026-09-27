import mongoose from "mongoose";

const teaFarmSchema = new mongoose.Schema(
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

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    productionRecords: [
      {
        date: Date,
        quantityKg: Number,
        grade: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("TeaFarm", teaFarmSchema);