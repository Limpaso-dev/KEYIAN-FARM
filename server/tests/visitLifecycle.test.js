import test from "node:test";
import assert from "node:assert/strict";

import {
  generateVisitNumber,
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
