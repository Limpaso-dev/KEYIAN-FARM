import test from "node:test";
import assert from "node:assert/strict";

import {
  hasRequestedLabOrder,
  getOutstandingLabOrders,
  normalizeLabOrders,
  normalizeLabStatus,
  VALID_LAB_STATUSES,
} from "../src/utils/lab.js";

import {
  normalizePrescriptionStatus,
  VALID_PRESCRIPTION_STATUSES,
} from "../src/utils/prescription.js";

test("normalizeLabStatus keeps lab results in the canonical HMIS states", () => {
  assert.equal(normalizeLabStatus("pending"), "pending");
  assert.equal(normalizeLabStatus("completed"), "completed");
  assert.equal(normalizeLabStatus("done"), "completed");
  assert.equal(normalizeLabStatus("in_progress"), "pending");
  assert.ok(VALID_LAB_STATUSES.includes("completed"));
});

test("lab orders are normalized and results can only match a requested test", () => {
  const labOrders = normalizeLabOrders([" CBC ", "cbc", "Urinalysis"]);

  assert.deepEqual(labOrders, ["CBC", "Urinalysis"]);
  assert.equal(hasRequestedLabOrder({ labOrders }, "cbc"), true);
  assert.equal(hasRequestedLabOrder({ labOrders }, "Blood Glucose"), false);
});

test("lab worklist retains only tests without completed results", () => {
  assert.deepEqual(
    getOutstandingLabOrders(["CBC", "Urinalysis", "Glucose"], ["cbc", "GLUCOSE"]),
    ["Urinalysis"]
  );
});

test("normalizePrescriptionStatus keeps pharmacy workflow states canonical", () => {
  assert.equal(normalizePrescriptionStatus("prescribed"), "prescribed");
  assert.equal(normalizePrescriptionStatus("dispensed"), "dispensed");
  assert.equal(normalizePrescriptionStatus("completed"), "dispensed");
  assert.equal(normalizePrescriptionStatus("voided"), "voided");
  assert.ok(VALID_PRESCRIPTION_STATUSES.includes("dispensed"));
});
