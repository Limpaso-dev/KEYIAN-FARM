import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import User from "../models/User.js";
import connectDB from "../config/db.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const email = "admin@keiyian.co.ke";
    const password = "Admin@12345";

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log("Admin account already exists.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
      name: "Keiyian System Administrator",
      email,
      password: hashedPassword,
      role: "super_admin",
      department: "Administration",
      isActive: true,
    });

    console.log("=================================");
    console.log("Super Admin created successfully");
    console.log("=================================");
    console.log(`Email: ${admin.email}`);
    console.log(`Password: ${password}`);
    console.log("Role: super_admin");
    console.log("=================================");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin:", error.message);

    await mongoose.connection.close();
    process.exit(1);
  }
};

seedAdmin();