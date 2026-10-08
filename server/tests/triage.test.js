import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveTriagePriority,
  isAllowedNurseTriageTransition,
  normalizeTriageAssessment,
} from "../src/utils/triage.js";

test("normalizeTriageAssessment parses vitals and urgency values", () => {
  const triage = normalizeTriageAssessment({
    temperature: "38.5",
    pulseRate: " 102 ",
    bloodPressure: " 120/80 ",
    respiratoryRate: "24",
    oxygenSaturation: "91",
    painScore: "7",
    triagePriority: "urgent",
    triageNotes: "  Low oxygen saturation  ",
  });

  assert.equal(triage.temperature, 38.5);
  assert.equal(triage.pulseRate, 102);
  assert.equal(triage.oxygenSaturation, 91);
  assert.equal(triage.triagePriority, "urgent");
  assert.equal(triage.triageNotes, "Low oxygen saturation");
  assert.equal(triage.triageCompletedAt, undefined);
});

test("deriveTriagePriority escalates emergency conditions", () => {
  const emergency = deriveTriagePriority({
    oxygenSaturation: 88,
    respiratoryRate: 30,
    pulseRate: 130,
  });

  assert.equal(emergency, "emergency");

  const routine = deriveTriagePriority({
    oxygenSaturation: 97,
    respiratoryRate: 17,
    pulseRate: 75,
  });

  assert.equal(routine, "routine");
});

test("normalizeTriageAssessment does not let a manual priority downgrade critical vitals", () => {
  const triage = normalizeTriageAssessment({
    oxygenSaturation: 88,
    triagePriority: "routine",
  });

  assert.equal(triage.triagePriority, "emergency");
});

test("nurse triage requires start then handoff and cannot reopen a handed-off visit", () => {
  assert.equal(isAllowedNurseTriageTransition("waiting_for_triage", "in_triage"), true);
  assert.equal(isAllowedNurseTriageTransition("waiting_for_triage", "waiting_for_doctor"), false);
  assert.equal(isAllowedNurseTriageTransition("in_triage", "waiting_for_doctor"), true);
  assert.equal(isAllowedNurseTriageTransition("waiting_for_doctor", "in_triage"), false);
});
