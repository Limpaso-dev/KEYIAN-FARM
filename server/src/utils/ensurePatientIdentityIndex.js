import prisma from "../config/prisma.js";

const normalizeIdentity = (value) => String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");

export const ensurePatientIdentityIndex = async () => {
  const records = await prisma.patient.findMany({
    where: { nationalId: { not: null } },
    select: { id: true, patientNumber: true, nationalId: true },
  });
  const seen = new Map();
  const duplicates = [];

  for (const patient of records) {
    const identity = normalizeIdentity(patient.nationalId);
    if (!identity) continue;
    const previous = seen.get(identity);
    if (previous) {
      duplicates.push(`${identity}: ${previous} and ${patient.patientNumber || patient.id}`);
    } else {
      seen.set(identity, patient.patientNumber || patient.id);
    }
  }
  if (duplicates.length) {
    throw new Error(
      `Cannot enforce unique patient identities until existing duplicates are resolved: ${duplicates.join("; ")}`,
    );
  }

  for (const patient of records) {
    const identity = normalizeIdentity(patient.nationalId);
    if (identity !== patient.nationalId) {
      await prisma.patient.update({
        where: { id: patient.id },
        data: { nationalId: identity || null },
      });
    }
  }
};
