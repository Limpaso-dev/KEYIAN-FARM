import test from "node:test";
import assert from "node:assert/strict";

import {
  generateVisitNumber,
  isAllowedDoctorVisitTransition,
  normalizeVisitStatus,
} from "../src/utils/visitLifecycle.js";

test("generateVisitNumber returns a HMIS visit code", () => {
  const number = generateVisitNumber();

  assert.match(number, /^VIS-/);
  assert.ok(number.length >= 12);
});

test("normalizeVisitStatus maps legacy UI values to canonical lifecycle states", () => {
  assert.equal(normalizeVisitStatus("open"), "registered");
  assert.equal(normalizeVisitStatus("completed"), "cleared");
  assert.equal(normalizeVisitStatus("waiting_for_triage"), "waiting_for_triage");
  assert.equal(normalizeVisitStatus("cancelled"), "cancelled");
});

test("doctor visit transitions support consultation, lab, pharmacy, and billing handoffs", () => {
  assert.equal(isAllowedDoctorVisitTransition("waiting_for_doctor", "in_consultation"), true);
  assert.equal(isAllowedDoctorVisitTransition("in_consultation", "awaiting_results"), true);
  assert.equal(isAllowedDoctorVisitTransition("in_consultation", "awaiting_pharmacy"), true);
  assert.equal(isAllowedDoctorVisitTransition("in_consultation", "awaiting_billing"), true);
  assert.equal(isAllowedDoctorVisitTransition("waiting_for_doctor", "awaiting_billing"), false);
  assert.equal(isAllowedDoctorVisitTransition("awaiting_results", "awaiting_billing"), false);
});
