import "dotenv/config";
import app from "./app.js";
import prisma, { connectPrisma, disconnectPrisma } from "./config/prisma.js";
import { ensureReferenceData } from "./lib/referenceData.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be set");
  if (process.env.JWT_SECRET.length < 32) {
    const message = "JWT_SECRET should be a random value of at least 32 characters";
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(`Warning: ${message}`);
  }
  await connectPrisma();
  try {
    await ensureReferenceData(prisma);
  } catch (error) {
    await disconnectPrisma();
    throw error;
  }

  const server = app.listen(PORT, () => console.log(`Keiyian ERP server running on port ${PORT}`));

  const shutdown = async () => {
    try {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    } finally {
      await disconnectPrisma();
    }
  };
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      shutdown().catch((error) => {
        console.error("Server shutdown failed:", error.message);
        process.exitCode = 1;
      });
    });
  }
};

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exitCode = 1;
});
