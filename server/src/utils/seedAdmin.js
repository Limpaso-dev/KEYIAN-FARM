import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma, { disconnectPrisma } from "../config/prisma.js";

const seedAdmin = async () => {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: process.env.SEED_ADMIN_NAME?.trim() || "Keiyian System Administrator",
        email,
        password: hashedPassword,
        role: "super_admin",
        department: "Administration",
        isActive: true,
        emailVerified: true,
      },
    });

    console.log(`Super administrator ${admin.email} is ready.`);
  } finally {
    await disconnectPrisma();
  }
};

seedAdmin().catch((error) => {
  console.error("Failed to create administrator:", error.message);
  process.exitCode = 1;
});