import test from "node:test";
import assert from "node:assert/strict";
import { ageText, cycleName, monthsBetween, standingSince } from "../src/modules/crops/cropCycle.js";

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

test("crop age reads in days, then months, then years", () => {
  assert.equal(ageText(day("2026-11-16"), day("2026-11-16")), "0 days");
  assert.equal(ageText(day("2026-11-15"), day("2026-11-16")), "1 day");
  assert.equal(ageText(day("2026-10-20"), day("2026-11-16")), "27 days");
  assert.equal(ageText(day("2026-10-16"), day("2026-11-16")), "1 month");
  // Cane is reckoned in months right up to its cut.
  assert.equal(ageText(day("2025-01-08"), day("2026-11-16")), "22 months");
  assert.equal(ageText(day("2022-06-07"), day("2026-11-16")), "4 yr 5 mo");
  assert.equal(ageText(day("2022-11-16"), day("2026-11-16")), "4 yr");
  assert.equal(ageText(null, day("2026-11-16")), "");
  assert.equal(ageText(day("2026-12-01"), day("2026-11-16")), "");
});

test("age counts from planting, or from the last harvest for crops that grow again", () => {
  const asAt = day("2026-11-16");
  const cane = { cropType: "sugarcane", plantingDate: day("2024-01-10"), cycleStartDate: day("2025-03-01") };
  // Cut since the recorded start of the current ratoon: it grows from the cut.
  assert.deepEqual(standingSince(cane, day("2026-02-20"), asAt), day("2026-02-20"));
  // No cut recorded since: from the start of the current crop.
  assert.deepEqual(standingSince(cane, day("2024-12-01"), asAt), day("2025-03-01"));
  assert.deepEqual(standingSince({ ...cane, cycleStartDate: null }, null, asAt), day("2024-01-10"));
  // A report for an earlier day leaves out what came after it.
  assert.deepEqual(standingSince(cane, day("2026-02-20"), day("2025-06-30")), day("2025-03-01"));
  // Fodder grows again after each cut.
  assert.deepEqual(standingSince({ cropType: "fodder", plantingDate: day("2026-01-05") }, day("2026-10-01"), asAt), day("2026-10-01"));
  // Tea and coffee are picked from the same bushes: their age is from planting.
  assert.deepEqual(standingSince({ cropType: "tea", plantingDate: day("2022-06-07") }, day("2026-11-15"), asAt), day("2022-06-07"));
  assert.deepEqual(standingSince({ cropType: "coffee", plantingDate: day("2025-02-07") }, day("2026-06-01"), asAt), day("2025-02-07"));
  assert.equal(standingSince({ cropType: "tea", plantingDate: null }, day("2026-11-15"), asAt), null);
});
