const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const normalizeConsultationSummary = (payload = {}) => {
  const assessment = normalizeText(payload.assessment);
  const diagnosis = normalizeText(payload.diagnosis);
  const treatmentPlan = normalizeText(payload.treatmentPlan);
  const followUpDate = normalizeText(payload.followUpDate);
  const disposition = normalizeText(payload.disposition || "").toLowerCase();

  return {
    assessment,
    diagnosis,
    treatmentPlan,
    followUpDate: followUpDate || undefined,
    disposition: ["admit", "discharge", "refer", "observe", "follow_up"].includes(disposition)
      ? disposition
      : "observe",
  };
};

export const determineDisposition = (payload = {}) => {
  if (payload.admissionRequired || payload.admit) return "admit";
  if (payload.referred || payload.referralNeeded) return "refer";
  if (payload.discharged || payload.discharge) return "discharge";
  if (payload.observe || payload.observationNeeded) return "observe";
  return "follow_up";
};
