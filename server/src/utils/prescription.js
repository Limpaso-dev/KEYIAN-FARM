export const VALID_PRESCRIPTION_STATUSES = [
  "prescribed",
  "dispensed",
  "cancelled",
  "voided",
];

export const LEGACY_PRESCRIPTION_STATUS_ALIASES = {
  pending: "prescribed",
  "in_progress": "prescribed",
  "in-progress": "prescribed",
  done: "dispensed",
  completed: "dispensed",
  issued: "dispensed",
  started: "prescribed",
};

export const normalizePrescriptionStatus = (status, data = {}) => {
  const raw = String(status ?? data?.status ?? "").trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, "_");

  if (!normalized) {
    return data?.medications?.length ? "prescribed" : "cancelled";
  }

  if (LEGACY_PRESCRIPTION_STATUS_ALIASES[normalized]) {
    return LEGACY_PRESCRIPTION_STATUS_ALIASES[normalized];
  }

  if (VALID_PRESCRIPTION_STATUSES.includes(normalized)) {
    return normalized;
  }

  return data?.medications?.length ? "prescribed" : "cancelled";
};
