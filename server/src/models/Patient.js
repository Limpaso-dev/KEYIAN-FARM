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

    nextOfKin: {
      name: String,
      phone: String,
      relationship: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Patient", patientSchema);