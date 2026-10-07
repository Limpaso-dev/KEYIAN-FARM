import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveTriagePriority,
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
