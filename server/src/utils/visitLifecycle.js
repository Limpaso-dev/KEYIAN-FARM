const VALID_VISIT_STATUSES = [
  "registered",
  "waiting_for_triage",
  "in_triage",
  "waiting_for_doctor",
  "in_consultation",
  "awaiting_investigations",
  "awaiting_results",
  "awaiting_pharmacy",
  "admitted",
  "discharge_pending",
  "cleared",
  "closed",
  "cancelled",
  "voided",
  "left_without_being_seen",
  "referred",
  "deceased",
];

const LEGACY_STATUS_ALIASES = {
  open: "registered",
  completed: "cleared",
  pending: "waiting_for_triage",
  in_progress: "waiting_for_doctor",
  active: "registered",
};

export const normalizeVisitStatus = (status) => {
  const raw = String(status ?? "").trim();

  if (!raw) return "registered";

  const normalized = raw.toLowerCase();

  if (LEGACY_STATUS_ALIASES[normalized]) {
    return LEGACY_STATUS_ALIASES[normalized];
  }

  return VALID_VISIT_STATUSES.includes(normalized)
    ? normalized
    : "registered";
};

export const generateVisitNumber = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const suffix = Math.random()
    .toString(36)
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toUpperCase();

  return `VIS-${year}${month}${day}-${suffix}`;
};
