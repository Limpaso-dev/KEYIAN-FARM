const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const deriveTriagePriority = (vitals = {}) => {
  const temperature = toNumber(vitals.temperature);
  const pulseRate = toNumber(vitals.pulseRate);
  const respiratoryRate = toNumber(vitals.respiratoryRate);
  const oxygenSaturation = toNumber(vitals.oxygenSaturation);
  const painScore = toNumber(vitals.painScore);

  if (
    oxygenSaturation !== undefined && oxygenSaturation <= 90 ||
    respiratoryRate !== undefined && respiratoryRate >= 30 ||
    pulseRate !== undefined && pulseRate >= 130 ||
    temperature !== undefined && temperature >= 40
  ) {
    return "emergency";
  }

  if (
    temperature !== undefined && temperature >= 38.5 ||
    pulseRate !== undefined && pulseRate >= 100 ||
    respiratoryRate !== undefined && respiratoryRate >= 24 ||
    oxygenSaturation !== undefined && oxygenSaturation <= 94 ||
    painScore !== undefined && painScore >= 7
  ) {
    return "urgent";
  }

  return "routine";
};

export const normalizeTriageAssessment = (payload = {}) => {
  const temperature = toNumber(payload.temperature);
  const pulseRate = toNumber(payload.pulseRate);
  const respiratoryRate = toNumber(payload.respiratoryRate);
  const oxygenSaturation = toNumber(payload.oxygenSaturation);
  const painScore = toNumber(payload.painScore);
  const weightKg = toNumber(payload.weightKg);
  const heightCm = toNumber(payload.heightCm);

  const triagePriority =
    payload.triagePriority && ["routine", "urgent", "emergency"].includes(String(payload.triagePriority).toLowerCase())
      ? String(payload.triagePriority).toLowerCase()
      : deriveTriagePriority({
          temperature,
          pulseRate,
          respiratoryRate,
          oxygenSaturation,
          painScore,
        });

  return {
    temperature,
    pulseRate,
    respiratoryRate,
    bloodPressure: normalizeText(payload.bloodPressure),
    oxygenSaturation,
    weightKg,
    heightCm,
    painScore,
    triagePriority,
    triageNotes: normalizeText(payload.triageNotes),
    triageCompletedAt: payload.triageCompletedAt || new Date(),
  };
};
