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

    visitNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    visitDate: {
      type: Date,
      default: Date.now,
    },

    visitType: {
      type: String,
      enum: [
        "outpatient",
        "follow_up",
        "emergency",
        "inpatient",
        "antenatal",
        "dental",
        "specialty_clinic",
      ],
      default: "outpatient",
    },

    chiefComplaint: String,

    clinicalNotes: String,

    diagnosis: String,

    treatmentPlan: String,

    status: {
      type: String,
      enum: [
        "registered",
        "waiting_for_triage",
        "in_triage",
        "waiting_for_doctor",
        "in_consultation",
        "awaiting_investigations",
        "awaiting_results",
        "awaiting_pharmacy",
        "admitted",
        "discharge_pending",
        "cleared",
        "closed",
        "cancelled",
        "voided",
        "left_without_being_seen",
        "referred",
        "deceased",
      ],
      default: "registered",
    },

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

export default mongoose.model("MedicalVisit", medicalVisitSchema);