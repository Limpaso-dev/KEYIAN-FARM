const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizePhone = (value) => {
  const text = normalizeText(value).replace(/\s+/g, "");
  return text.replace(/[^\d+]/g, "");
};

export const generatePatientNumber = () => {
  const timeCode = Date.now().toString().slice(-6);
  const randomCode = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `P-${timeCode}-${randomCode}`;
};

export const normalizePatientRegistration = (payload = {}) => {
  const patientNumber = normalizeText(payload.patientNumber) || generatePatientNumber();
  const firstName = normalizeText(payload.firstName);
  const lastName = normalizeText(payload.lastName);
  const sex = normalizeText(payload.sex).toLowerCase();
  const dateOfBirth = normalizeText(payload.dateOfBirth);
  const phone = normalizePhone(payload.phone);
  const address = normalizeText(payload.address);
  const nationalId = normalizeText(payload.nationalId).toUpperCase().replace(/[\s-]+/g, "");
  const estimatedAge = payload.estimatedAge === undefined || payload.estimatedAge === null || payload.estimatedAge === ""
    ? undefined
    : Number(payload.estimatedAge);

  return {
    patientNumber,
    firstName,
    lastName,
    dateOfBirth: dateOfBirth || undefined,
    sex: ["male", "female", "other"].includes(sex) ? sex : "other",
    phone,
    address,
    nationalId: nationalId || undefined,
    estimatedAge: Number.isFinite(estimatedAge) ? estimatedAge : undefined,
    consentAcknowledged: Boolean(payload.consentAcknowledged),
    payer: normalizeText(payload.payer) || "cash",
    payerDetails: payload.payerDetails || {},
    isTemporary: Boolean(payload.isTemporary),
    temporaryId: normalizeText(payload.temporaryId) || undefined,
    nextOfKin: {
      name: normalizeText(payload.nextOfKin?.name),
      phone: normalizePhone(payload.nextOfKin?.phone),
      relationship: normalizeText(payload.nextOfKin?.relationship),
    },
  };
};

export const findPossibleDuplicates = (existingPatients = [], candidate = {}) => {
  const normalizedCandidate = normalizePatientRegistration(candidate);
  const candidateName = `${normalizedCandidate.firstName} ${normalizedCandidate.lastName}`.trim();

  return existingPatients.filter((patient) => {
    if (!patient) return false;

    const comparablePatient = normalizePatientRegistration(patient);
    const samePhone = normalizedCandidate.phone && comparablePatient.phone && normalizedCandidate.phone === comparablePatient.phone;
    const sameNationalId = normalizedCandidate.nationalId && comparablePatient.nationalId && normalizedCandidate.nationalId === comparablePatient.nationalId;
    const firstLastMatch =
      normalizedCandidate.firstName &&
      normalizedCandidate.lastName &&
      comparablePatient.firstName &&
      comparablePatient.lastName &&
      normalizedCandidate.firstName.toLowerCase() === comparablePatient.firstName.toLowerCase() &&
      normalizedCandidate.lastName.toLowerCase() === comparablePatient.lastName.toLowerCase();

    const fuzzyName =
      candidateName &&
      patient.firstName &&
      patient.lastName &&
      normalizedCandidate.firstName.toLowerCase().slice(0, 3) === patient.firstName.toLowerCase().slice(0, 3) &&
      normalizedCandidate.lastName.toLowerCase().slice(0, 3) === patient.lastName.toLowerCase().slice(0, 3);

    return Boolean(samePhone || sameNationalId || firstLastMatch || fuzzyName);
  });
};
