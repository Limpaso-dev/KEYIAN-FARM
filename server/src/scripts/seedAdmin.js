import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma, { disconnectPrisma } from "../config/prisma.js";
import { ensureReferenceData } from "../lib/referenceData.js";

// Creates the first super admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
// Re-running leaves an existing account unchanged.
const seed = async () => {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters");

  try {
    await ensureReferenceData(prisma);
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: process.env.SEED_ADMIN_NAME?.trim() || "Keiyian System Administrator",
        email,
        password: await bcrypt.hash(password, 12),
        role: "super_admin",
        mustChangePassword: false,
      },
    });
    console.log(`Super admin ${admin.email} is ready.`);
  } finally {
    await disconnectPrisma();
  }
};

seed().catch((error) => {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
});
