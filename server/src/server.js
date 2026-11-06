import "dotenv/config";
import app from "./app.js";
import { connectPrisma, disconnectPrisma } from "./config/prisma.js";
import { ensureCashAccount } from "./utils/ensureCashAccount.js";
import { ensurePatientIdentityIndex } from "./utils/ensurePatientIdentityIndex.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectPrisma();
  try {
    await ensureCashAccount();
    await ensurePatientIdentityIndex();
  } catch (error) {
    await disconnectPrisma();
    throw error;
  }

  const server = app.listen(PORT, () => {
    console.log(`Keiyian ERP server running on port ${PORT}`);
  });

  const shutdown = async () => {
    try {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
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
