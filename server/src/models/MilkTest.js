import mongoose from "mongoose";

const milkTestSchema = new mongoose.Schema(
  {
    milkCollection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MilkCollection",
      required: true,
    },

    sampleNumber: {
      type: String,
      required: true,
      unique: true,
    },

    fatPercentage: Number,
    proteinPercentage: Number,
    snfPercentage: Number,

    acidity: Number,
    temperature: Number,

    result: {
      type: String,
      enum: ["pass", "fail", "pending"],
      default: "pending",
    },

    testedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    testedAt: Date,

    remarks: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("MilkTest", milkTestSchema);