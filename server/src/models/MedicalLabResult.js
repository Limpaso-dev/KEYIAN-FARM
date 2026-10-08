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

    unitPrice: { type: Number, min: 0, default: 2000 },

    result: String,

    referenceRange: String,

    status: {
      type: String,
      enum: ["ordered", "collected", "received", "pending", "completed", "cancelled", "voided"],
      default: "ordered",
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    performedAt: Date,

    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    voidReason: String,
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    voidedAt: Date,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "MedicalLabResult",
  medicalLabResultSchema
);
