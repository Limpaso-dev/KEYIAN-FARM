import mongoose from "mongoose";

const medicalVisitSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    clinician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    visitDate: {
      type: Date,
      default: Date.now,
    },

    visitType: {
      type: String,
      enum: ["outpatient", "follow_up", "emergency"],
      default: "outpatient",
    },

    chiefComplaint: String,

    clinicalNotes: String,

    diagnosis: String,

    treatmentPlan: String,

    status: {
      type: String,
      enum: ["open", "completed", "cancelled"],
      default: "open",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("MedicalVisit", medicalVisitSchema);