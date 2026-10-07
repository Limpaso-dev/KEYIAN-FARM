import test from "node:test";
import assert from "node:assert/strict";

import { buildAuditPayload, softDeleteRecord } from "../src/utils/globalRules.js";

test("buildAuditPayload captures actor, action, and before/after values", () => {
  const payload = buildAuditPayload({
    actor: { _id: "user-1", role: "doctor" },
    action: "update",
    entity: "Patient",
    entityId: "patient-1",
    before: { status: "registered" },
    after: { status: "in_consultation" },
    metadata: { ip: "127.0.0.1" },
  });

  assert.equal(payload.action, "update");
  assert.equal(payload.actorId, "user-1");
  assert.equal(payload.actorRole, "doctor");
  assert.equal(payload.entity, "Patient");
  assert.deepEqual(payload.before, { status: "registered" });
  assert.deepEqual(payload.after, { status: "in_consultation" });
  assert.equal(payload.metadata.ip, "127.0.0.1");
});

test("softDeleteRecord marks the record as voided without removing it", async () => {
  const record = { _id: "record-1", status: "registered", deletedAt: null };

  const result = softDeleteRecord(record, {
    actor: { _id: "user-2", role: "admin" },
    reason: "duplicate entry",
  });

  assert.equal(result.deletedAt !== null, true);
  assert.equal(result.voidReason, "duplicate entry");
  assert.equal(result.voidedBy.toString(), "user-2");
  assert.equal(result.status, "voided");
});
