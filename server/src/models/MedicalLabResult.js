import mongoose from "mongoose";

const medicalLabResultSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalVisit",
    },

    testName: {
      type: String,
      required: true,
    },

    result: String,

    referenceRange: String,

    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    performedAt: Date,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "MedicalLabResult",
  medicalLabResultSchema
);