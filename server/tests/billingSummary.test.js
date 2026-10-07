import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePatientBillingSummary,
} from "../src/utils/billing.js";

test("calculatePatientBillingSummary aggregates visit, lab, and prescription charges into a single payable total", () => {
  const result = calculatePatientBillingSummary({
    visit: {
      status: "admitted",
      triageCompletedAt: "2026-01-02T08:00:00.000Z",
      diagnosis: "Malaria",
      dischargeSummary: "Recovered",
      disposition: "discharge",
    },
    labResults: [
      { status: "completed", testName: "Malaria Parasite", result: "Positive" },
      { status: "completed", testName: "CBC", result: "Normal" },
    ],
    prescriptions: [
      { medications: [{ quantity: 2 }, { quantity: 1 }] },
    ],
    amountPaid: 3000,
  });

  assert.ok(result.totalAmount > 0);
  assert.equal(result.balance, Math.max(result.totalAmount - 3000, 0));
  assert.ok(Array.isArray(result.items));
  assert.ok(result.items.some((item) => item.description.toLowerCase().includes("consultation") || item.description.toLowerCase().includes("admission") || item.description.toLowerCase().includes("lab") || item.description.toLowerCase().includes("prescription")));
});
