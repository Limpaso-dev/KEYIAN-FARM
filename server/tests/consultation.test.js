import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeConsultationSummary,
  determineDisposition,
} from "../src/utils/consultation.js";

test("normalizeConsultationSummary trims and quantifies clinical information", () => {
  const consultation = normalizeConsultationSummary({
    assessment: "  Stable patient with mild fever  ",
    diagnosis: "  Viral infection  ",
    treatmentPlan: "  Rest and hydration  ",
    followUpDate: "2026-10-15",
    disposition: "admit",
  });

  assert.equal(consultation.assessment, "Stable patient with mild fever");
  assert.equal(consultation.diagnosis, "Viral infection");
  assert.equal(consultation.followUpDate, "2026-10-15");
  assert.equal(consultation.disposition, "admit");
});

test("determineDisposition chooses the correct post-consultation outcome", () => {
  assert.equal(determineDisposition({ admissionRequired: true, referred: false }), "admit");
  assert.equal(determineDisposition({ referralNeeded: true }), "refer");
  assert.equal(determineDisposition({ discharged: true }), "discharge");
});
