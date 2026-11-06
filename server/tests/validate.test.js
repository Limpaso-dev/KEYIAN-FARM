import test from "node:test";
import assert from "node:assert/strict";
import { parseBody, parseItems, round2, toDate } from "../src/lib/validate.js";

test("converts and checks field types", () => {
  const data = parseBody(
    { name: "string!", litres: "decimal!", count: "int", day: "date!", sex: "option:animalSex", active: "bool" },
    { name: "  Daisy ", litres: "12.5", count: "3", day: "2026-11-06", sex: "female", active: "true", extra: "ignored" },
  );
  assert.deepEqual(data, { name: "Daisy", litres: 12.5, count: 3, day: new Date("2026-11-06T00:00:00.000Z"), sex: "female", active: true });
});

test("reports every problem at once", () => {
  assert.throws(
    () => parseBody({ name: "string!", litres: "decimal!", sex: "option:animalSex" }, { litres: "-1", sex: "cow" }),
    (error) => error.status === 400 && error.details.length === 3,
  );
});

test("partial updates leave missing fields out and blank optionals become null", () => {
  assert.deepEqual(parseBody({ name: "string!", phone: "string" }, { phone: "" }, { partial: true }), { phone: null });
});

test("line items need at least one row and are numbered in errors", () => {
  assert.throws(() => parseItems([], { qty: "decimal!" }), /at least 1/);
  assert.throws(() => parseItems([{ qty: 1 }, { qty: "x" }], { qty: "decimal!" }), /Line 2/);
});

test("helpers", () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(toDate("not a date"), null);
});
