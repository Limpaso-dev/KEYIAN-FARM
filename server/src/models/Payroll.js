import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    period: {
      type: String,
      required: true,
      trim: true,
    },

    basicSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    allowances: {
      type: Number,
      default: 0,
      min: 0,
    },

    grossSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },

    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["draft", "approved", "paid"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Payroll", payrollSchema);