import mongoose from "mongoose";

const farmerSchema = new mongoose.Schema(
  {
    membershipNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    nationalId: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: String,

    address: String,

    farmLocation: String,

    membershipStatus: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    shares: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Farmer", farmerSchema);