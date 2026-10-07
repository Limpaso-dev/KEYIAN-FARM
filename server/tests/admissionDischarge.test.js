import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAdmissionRequest,
  normalizeDischargeSummary,
} from "../src/utils/admission.js";

test("normalizeAdmissionRequest canonicalizes inpatient admission data", () => {
  const result = normalizeAdmissionRequest({
    status: "in_progress",
    ward: "Ward A",
    bedNumber: "A-12",
    admissionReason: "Observation for fever",
  });

  assert.equal(result.status, "admitted");
  assert.equal(result.ward, "Ward A");
  assert.equal(result.bedNumber, "A-12");
  assert.equal(result.admissionReason, "Observation for fever");
  assert.ok(result.admittedAt instanceof Date);
});

test("normalizeDischargeSummary prepares a valid discharge summary and close-out state", () => {
  const result = normalizeDischargeSummary({
    status: "pending",
    disposition: "discharge",
    dischargeSummary: "Patient stable and discharged with oral antibiotics.",
    dischargePlan: "Follow up in 5 days",
  });

  assert.equal(result.status, "discharge_pending");
  assert.equal(result.disposition, "discharge");
  assert.match(result.dischargeSummary, /stable/i);
  assert.equal(result.dischargePlan, "Follow up in 5 days");
  assert.ok(result.dischargedAt instanceof Date);
});
