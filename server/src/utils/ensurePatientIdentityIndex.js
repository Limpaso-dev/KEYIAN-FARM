import mongoose from "mongoose";

const normalizeIdentity = (value) => String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");

export const ensurePatientIdentityIndex = async () => {
  const patients = mongoose.connection.collection("patients");
  const records = await patients.find({ nationalId: { $exists: true, $nin: [null, ""] } })
    .project({ _id: 1, patientNumber: 1, nationalId: 1 })
    .toArray();
  const seen = new Map();
  const duplicates = [];

  for (const patient of records) {
    const identity = normalizeIdentity(patient.nationalId);
    if (!identity) continue;
    const previous = seen.get(identity);
    if (previous) duplicates.push(`${identity}: ${previous} and ${patient.patientNumber || patient._id}`);
    else seen.set(identity, patient.patientNumber || String(patient._id));
  }
  if (duplicates.length) {
    throw new Error(`Cannot enforce unique patient identities until existing duplicates are resolved: ${duplicates.join("; ")}`);
  }

  for (const patient of records) {
    const identity = normalizeIdentity(patient.nationalId);
    if (identity !== patient.nationalId) await patients.updateOne({ _id: patient._id }, { $set: { nationalId: identity } });
  }
  await patients.updateMany({ nationalId: { $in: [null, ""] } }, { $unset: { nationalId: "" } });

  const identityIndex = (await patients.indexes()).find((index) => index.key?.nationalId === 1);
  if (identityIndex && (!identityIndex.unique || !identityIndex.sparse)) await patients.dropIndex(identityIndex.name);
  await patients.createIndex({ nationalId: 1 }, { unique: true, sparse: true, name: "nationalId_unique" });
};
