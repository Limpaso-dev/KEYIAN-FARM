import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema(
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

    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    medications: [
      {
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
        quantity: Number,
        instructions: String,
      },
    ],

    status: {
      type: String,
      enum: ["prescribed", "dispensed", "cancelled"],
      default: "prescribed",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Prescription", prescriptionSchema);