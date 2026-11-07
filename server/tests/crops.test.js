import test from "node:test";
import assert from "node:assert/strict";

// The report module imports the Prisma client, which needs a URL to be
// constructed (it does not connect until used).
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/unused";
const { cycleName, monthsBetween, periodRange } = await import("../src/modules/crops/crops.reports.js");

const day = (text) => new Date(`${text}T00:00:00.000Z`);
const iso = (date) => date.toISOString().slice(0, 10);

test("monthly, quarterly, half-year and annual ranges", () => {
  const may = periodRange("month", 2024, 5);
  assert.equal(iso(may.from), "2024-05-01");
  assert.equal(iso(may.lastDay), "2024-05-31");
  assert.equal(may.label, "May 2024");
  assert.equal(may.previous.label, "April 2024");

  const q2 = periodRange("quarter", 2024, 2);
  assert.equal(iso(q2.from), "2024-04-01");
  assert.equal(iso(q2.to), "2024-07-01");
  assert.equal(q2.label, "Q2 2024 (Apr - Jun)");

  const h2 = periodRange("half", 2024, 2);
  assert.equal(iso(h2.from), "2024-07-01");
  assert.equal(iso(h2.lastDay), "2024-12-31");
  assert.equal(h2.label, "Second half 2024 (Jul - Dec)");

  const year = periodRange("year", 2024);
  assert.equal(iso(year.from), "2024-01-01");
  assert.equal(iso(year.to), "2025-01-01");
  assert.equal(year.previous.label, "Year 2023");
});

test("the first period of a year compares with the last one of the year before", () => {
  assert.equal(periodRange("month", 2024, 1).previous.label, "December 2023");
  assert.equal(periodRange("quarter", 2024, 1).previous.label, "Q4 2023 (Oct - Dec)");
  assert.equal(periodRange("half", 2024, 1).previous.label, "Second half 2023 (Jul - Dec)");
});

test("a past period is reported as at its last day", () => {
  assert.equal(iso(periodRange("month", 2024, 6).asAt), "2024-06-30");
});

test("bad periods are rejected", () => {
  assert.throws(() => periodRange("week", 2024, 1));
  assert.throws(() => periodRange("month", 2024, 13));
  assert.throws(() => periodRange("quarter", 2024, 0));
  assert.throws(() => periodRange("month", 1990, 1));
});

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
