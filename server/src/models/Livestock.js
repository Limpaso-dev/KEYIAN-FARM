import mongoose from "mongoose";

const livestockSchema = new mongoose.Schema(
  {
    animalTag: {
      type: String,
      required: true,
      unique: true,
    },

    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
    },

    species: {
      type: String,
      enum: ["cattle", "goat", "sheep", "pig", "poultry", "other"],
      required: true,
    },

    breed: String,

    sex: {
      type: String,
      enum: ["male", "female"],
    },

    dateOfBirth: Date,

    healthStatus: {
      type: String,
      default: "healthy",
    },

    status: {
      type: String,
      enum: ["active", "sold", "deceased", "transferred"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Livestock", livestockSchema);