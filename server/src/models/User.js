import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      required: true,
      enum: [
        "super_admin",
        "admin",
        "manager",
        "receptionist",
        "cashier",
        "radiology",
        "pharmacy",
        "finance",
        "hr",
        "procurement",
        "stores",
        "livestock",
        "dairy",
        "laboratory",
        "doctor",
        "nurse",
        "pharmacist",
        "sales",
        "farm_officer",
        "staff",
      ],
    },

    department: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    emailVerified: {
      type: Boolean,
      default: true,
    },

    emailVerificationCodeHash: {
      type: String,
      select: false,
    },

    emailVerificationExpiresAt: {
      type: Date,
      select: false,
    },

    emailVerificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    emailVerificationLastSentAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);
