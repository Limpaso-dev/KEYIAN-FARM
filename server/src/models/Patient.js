import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    patientNumber: {
      type: String,
      required: true,
      unique: true,
    },

    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
    },

    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    dateOfBirth: Date,

    sex: {
      type: String,
      enum: ["male", "female", "other"],
    },

    phone: String,

    address: String,

    nationalId: String,

    status: {
      type: String,
      enum: ["registered", "in_queue", "in_consultation", "closed", "voided"],
      default: "registered",
    },

    consentAcknowledged: {
      type: Boolean,
      default: false,
    },

    nextOfKin: {
      name: String,
      phone: String,
      relationship: String,
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

export default mongoose.model("Patient", patientSchema);