export const VALID_LAB_STATUSES = [
  "ordered",
  "collected",
  "received",
  "pending",
  "completed",
  "cancelled",
  "voided",
];

export const normalizeLabOrders = (orders = []) => {
  const values = Array.isArray(orders) ? orders : String(orders).split("\n");
  const uniqueOrders = new Map();

  values.forEach((order) => {
    const normalized = String(order || "").trim();
    if (normalized && !uniqueOrders.has(normalized.toLowerCase())) {
      uniqueOrders.set(normalized.toLowerCase(), normalized);
    }
  });

  return [...uniqueOrders.values()];
};

export const hasRequestedLabOrder = (visit, testName) => {
  const normalizedTestName = String(testName || "").trim().toLowerCase();
  return Boolean(normalizedTestName) && (visit?.labOrders || []).some(
    (order) => String(order).trim().toLowerCase() === normalizedTestName
  );
};

export const getOutstandingLabOrders = (orders = [], completedTestNames = []) => {
  const completed = new Set(completedTestNames.map((name) => String(name).trim().toLowerCase()));
  return normalizeLabOrders(orders).filter((order) => !completed.has(order.toLowerCase()));
};

export const LEGACY_LAB_STATUS_ALIASES = {
  open: "ordered",
  started: "ordered",
  done: "completed",
  completed: "completed",
  pending: "pending",
  "in_progress": "pending",
  "in-progress": "pending",
  "awaiting_result": "pending",
  "awaiting_results": "pending",
  "reviewed": "completed",
};

export const normalizeLabStatus = (status, data = {}) => {
  const raw = String(status ?? data?.status ?? "").trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, "_");

  if (!normalized) {
    return data?.result || data?.referenceRange ? "completed" : "pending";
  }

  if (LEGACY_LAB_STATUS_ALIASES[normalized]) {
    return LEGACY_LAB_STATUS_ALIASES[normalized];
  }

  if (VALID_LAB_STATUSES.includes(normalized)) {
    if (normalized === "completed" && !data?.result && !data?.referenceRange) {
      return "pending";
    }

    if (normalized === "pending" && (data?.result || data?.referenceRange)) {
      return "completed";
    }

    return normalized;
  }

  return data?.result || data?.referenceRange ? "completed" : "pending";
};
