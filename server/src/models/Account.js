import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    accountCode: {
      type: String,
      required: true,
      unique: true,
    },

    accountName: {
      type: String,
      required: true,
    },

    accountType: {
      type: String,
      enum: [
        "asset",
        "liability",
        "equity",
        "revenue",
        "expense",
      ],
      required: true,
    },

    openingBalance: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Account", accountSchema);