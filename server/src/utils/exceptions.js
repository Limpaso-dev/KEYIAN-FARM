const EXCEPTION_MAP = {
  left_without_being_seen: {
    status: "left_without_being_seen",
    label: "Left without being seen",
    severity: "medium",
  },
  lwbs: {
    status: "left_without_being_seen",
    label: "Left without being seen",
    severity: "medium",
  },
  referred: {
    status: "referred",
    label: "Referred",
    severity: "medium",
  },
  cancelled: {
    status: "cancelled",
    label: "Cancelled",
    severity: "medium",
  },
  voided: {
    status: "voided",
    label: "Voided",
    severity: "medium",
  },
  deceased: {
    status: "deceased",
    label: "Deceased",
    severity: "critical",
  },
  manual_back_entry: {
    status: "manual_back_entry",
    label: "Manual back entry",
    severity: "medium",
  },
  downtime_entry: {
    status: "downtime_entry",
    label: "Downtime entry",
    severity: "high",
  },
  merge_request: {
    status: "merge_request",
    label: "Merge request",
    severity: "high",
  },
  absconded: {
    status: "left_without_being_seen",
    label: "Left without being seen",
    severity: "medium",
  },
};

export const normalizeExceptionState = (status) => {
  const raw = String(status ?? "").trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, "_");

  if (!normalized) {
    return {
      status: "manual_back_entry",
      label: "Manual back entry",
      severity: "medium",
    };
  }

  return EXCEPTION_MAP[normalized] || {
    status: normalized,
    label: normalized.replace(/_/g, " "),
    severity: "low",
  };
};

export const buildExceptionQueue = (records = []) => {
  const queue = records
    .filter((record) => {
      const status = String(record?.status ?? "").trim();
      if (!status) return false;
      const normalized = status.toLowerCase().replace(/\s+/g, "_");
      return Boolean(EXCEPTION_MAP[normalized]);
    })
    .map((record) => {
      const normalized = normalizeExceptionState(record?.status);
      const patient = record?.patient || {};
      const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Unknown patient";

      return {
        id: String(record?._id || record?.id || `${patientName}-${record?.status}`),
        patientName,
        patientNumber: patient.patientNumber || "-",
        status: normalized.status,
        label: normalized.label,
        severity: normalized.severity,
        timestamp: record?.updatedAt || record?.createdAt || new Date().toISOString(),
      };
    })
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

  return queue;
};
