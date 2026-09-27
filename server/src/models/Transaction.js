import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },

    transactionDate: {
      type: Date,
      default: Date.now,
    },

    type: {
      type: String,
      enum: [
        "income",
        "expense",
        "payment",
        "receipt",
        "transfer",
        "journal",
      ],
      required: true,
    },

    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    description: String,

    status: {
      type: String,
      enum: ["pending", "approved", "posted", "cancelled"],
      default: "pending",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Transaction", transactionSchema);