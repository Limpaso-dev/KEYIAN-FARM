const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const normalizeAdmissionRequest = (payload = {}) => {
  const rawStatus = normalizeText(payload.status).toLowerCase().replace(/\s+/g, "_");
  const ward = normalizeText(payload.ward);
  const bedNumber = normalizeText(payload.bedNumber);
  const admissionReason = normalizeText(payload.admissionReason);

  const status = ["admitted", "admit", "in_progress", "in-progress", "pending", "waiting"].includes(rawStatus)
    ? "admitted"
    : "admitted";

  return {
    status,
    ward,
    bedNumber,
    admissionReason,
    admittedAt: payload.admittedAt ? new Date(payload.admittedAt) : new Date(),
  };
};

export const normalizeDischargeSummary = (payload = {}) => {
  const rawStatus = normalizeText(payload.status).toLowerCase().replace(/\s+/g, "_");
  const disposition = normalizeText(payload.disposition || "discharge").toLowerCase();
  const finalDisposition = ["discharge", "admit", "refer", "observe", "follow_up"].includes(disposition)
    ? disposition
    : "discharge";

  const normalizedStatus = {
    pending: "discharge_pending",
    "discharge_pending": "discharge_pending",
    "pending_discharge": "discharge_pending",
    discharged: "cleared",
    completed: "cleared",
    complete: "cleared",
    cleared: "cleared",
    closed: "cleared",
  }[rawStatus] || "discharge_pending";

  return {
    status: normalizedStatus,
    disposition: finalDisposition,
    dischargeSummary: normalizeText(payload.dischargeSummary),
    dischargePlan: normalizeText(payload.dischargePlan),
    dischargedAt: payload.dischargedAt ? new Date(payload.dischargedAt) : new Date(),
  };
};
