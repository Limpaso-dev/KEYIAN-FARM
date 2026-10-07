import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExceptionQueue,
  normalizeExceptionState,
} from "../src/utils/exceptions.js";

test("normalizeExceptionState maps operational exceptions to canonical HMIS flags", () => {
  assert.equal(normalizeExceptionState("left_without_being_seen").status, "left_without_being_seen");
  assert.equal(normalizeExceptionState("cancelled").severity, "medium");
  assert.equal(normalizeExceptionState("deceased").severity, "critical");
  assert.equal(normalizeExceptionState("manual_back_entry").status, "manual_back_entry");
});

test("buildExceptionQueue surfaces the queue within active operational exceptions", () => {
  const result = buildExceptionQueue([
    { _id: "v1", patient: { firstName: "Jane", lastName: "Njeri" }, status: "left_without_being_seen", updatedAt: "2026-01-02T12:00:00.000Z" },
    { _id: "v2", patient: { firstName: "John", lastName: "Kiptoo" }, status: "referred", updatedAt: "2026-01-02T08:00:00.000Z" },
    { _id: "v3", patient: { firstName: "Mary", lastName: "Wanjiku" }, status: "registered", updatedAt: "2026-01-02T10:00:00.000Z" },
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0].status, "left_without_being_seen");
  assert.equal(result[1].status, "referred");
});
