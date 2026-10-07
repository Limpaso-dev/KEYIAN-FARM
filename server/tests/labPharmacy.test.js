import test from "node:test";
import assert from "node:assert/strict";

import {
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

test("normalizePrescriptionStatus keeps pharmacy workflow states canonical", () => {
  assert.equal(normalizePrescriptionStatus("prescribed"), "prescribed");
  assert.equal(normalizePrescriptionStatus("dispensed"), "dispensed");
  assert.equal(normalizePrescriptionStatus("completed"), "dispensed");
  assert.equal(normalizePrescriptionStatus("voided"), "voided");
  assert.ok(VALID_PRESCRIPTION_STATUSES.includes("dispensed"));
});
