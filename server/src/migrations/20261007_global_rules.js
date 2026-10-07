import mongoose from "mongoose";

const ensureIndexes = async () => {
  const collections = [
    "patients",
    "medicalvisits",
    "medicallabresults",
    "prescriptions",
    "medicalbills",
    "auditlogs",
  ];

  for (const collectionName of collections) {
    const collection = mongoose.connection.collection(collectionName);

    if (collectionName === "patients") {
      await collection.createIndex({ patientNumber: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ deletedAt: 1, status: 1 });
      await collection.createIndex({ phone: 1 });
      await collection.createIndex({ nationalId: 1 }, { sparse: true, unique: false });
    }

    if (collectionName === "medicalvisits") {
      await collection.createIndex({ patient: 1, visitDate: -1 });
      await collection.createIndex({ visitNumber: 1 }, { sparse: true, unique: true });
      await collection.createIndex({ deletedAt: 1, status: 1 });
    }

    if (collectionName === "medicallabresults") {
      await collection.createIndex({ patient: 1, visit: 1 });
      await collection.createIndex({ deletedAt: 1, status: 1 });
    }

    if (collectionName === "prescriptions") {
      await collection.createIndex({ patient: 1, visit: 1 });
      await collection.createIndex({ deletedAt: 1, status: 1 });
    }

    if (collectionName === "medicalbills") {
      await collection.createIndex({ billNumber: 1 }, { unique: true, sparse: true });
      await collection.createIndex({ patient: 1, visit: 1 });
      await collection.createIndex({ deletedAt: 1, status: 1 });
    }

    if (collectionName === "auditlogs") {
      await collection.createIndex({ entity: 1, entityId: 1, createdAt: -1 });
      await collection.createIndex({ actorId: 1, createdAt: -1 });
    }
  }
};

const migration = async () => {
  try {
    await ensureIndexes();
    console.log("Global HMIS safety migration completed.");
  } catch (error) {
    console.error("Global HMIS safety migration failed:", error.message);
    throw error;
  }
};

export default migration;

if (process.argv[1]?.includes("20261007_global_rules.js")) {
  await migration();
  process.exit(0);
}
