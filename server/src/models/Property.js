import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    location: String,

    propertyType: {
      type: String,
      enum: ["residential", "commercial", "office", "other"],
    },

    units: [
      {
        unitNumber: String,
        monthlyRent: Number,
        status: {
          type: String,
          enum: ["vacant", "occupied", "maintenance"],
          default: "vacant",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Property", propertySchema);