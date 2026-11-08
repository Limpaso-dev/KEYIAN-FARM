import test from "node:test";
import assert from "node:assert/strict";

// The report module imports the Prisma client, which needs a URL to be
// constructed (it does not connect until used).
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/unused";
const { cycleName, monthsBetween } = await import("../src/modules/crops/crops.reports.js");

const day = (text) => new Date(`${text}T00:00:00.000Z`);

test("cane cycle names follow the plant crop and ratoon count", () => {
  assert.equal(cycleName(0), "PC");
  assert.equal(cycleName(1), "RI");
  assert.equal(cycleName(3), "RIII");
  assert.equal(cycleName(4), "RIV");
});

test("crop age in whole months", () => {
  assert.equal(monthsBetween(day("2023-11-13"), day("2024-03-01")), 3);
  assert.equal(monthsBetween(day("2024-01-15"), day("2024-03-15")), 2);
  assert.equal(monthsBetween(day("2024-01-15"), day("2024-03-14")), 1);
  assert.equal(monthsBetween(day("2024-05-01"), day("2024-03-01")), null);
  assert.equal(monthsBetween(null, day("2024-03-01")), null);
});
