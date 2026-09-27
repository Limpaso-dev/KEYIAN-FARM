import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    employeeNumber: {
      type: String,
      required: true,
      unique: true,
    },

    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    phone: String,

    email: String,

    department: String,

    position: String,

    employmentType: {
      type: String,
      enum: ["permanent", "contract", "casual", "intern"],
    },

    dateJoined: Date,

    salary: Number,

    status: {
      type: String,
      enum: ["active", "inactive", "terminated"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Employee", employeeSchema);