import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { ensureCashAccount } from "./utils/ensureCashAccount.js";
import { ensurePatientIdentityIndex } from "./utils/ensurePatientIdentityIndex.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await ensureCashAccount();
  await ensurePatientIdentityIndex();

  app.listen(PORT, () => {
    console.log(`Keiyian ERP server running on port ${PORT}`);
  });
};

startServer();
