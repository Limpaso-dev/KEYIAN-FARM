import test from "node:test";
import assert from "node:assert/strict";
import { bucketsOf, resolvePeriod, spanText } from "../src/lib/periods.js";

const iso = (date) => date.toISOString().slice(0, 10);
const day = (text) => new Date(`${text}T00:00:00.000Z`);

test("a single day, for urgent reports", () => {
  const r = resolvePeriod({ period: "day", date: "2026-11-08" });
  assert.equal(iso(r.from), "2026-11-08");
  assert.equal(r.days, 1);
  assert.equal(r.label, "08 Nov 2026");
  assert.equal(r.previous.label, "07 Nov 2026");
});

test("weeks run Monday to Sunday", () => {
  const r = resolvePeriod({ period: "week", date: "2026-11-05" }); // a Thursday
  assert.equal(iso(r.from), "2026-11-02");
  assert.equal(iso(r.lastDay), "2026-11-08");
  assert.equal(r.label, "Week 02–08 Nov 2026");
  assert.equal(iso(r.previous.from), "2026-10-26");
  assert.equal(r.slug, "week-2026-11-02");
});

test("two weeks start on the Monday of the chosen week", () => {
  const r = resolvePeriod({ period: "fortnight", date: "2026-10-28" });
  assert.equal(iso(r.from), "2026-10-26");
  assert.equal(iso(r.lastDay), "2026-11-08");
  assert.equal(r.days, 14);
  assert.equal(r.label, "Fortnight 26 Oct – 08 Nov 2026");
  assert.equal(iso(r.previous.from), "2026-10-12");
  assert.equal(iso(r.previous.lastDay), "2026-10-25");
});

test("monthly, quarterly, half-year and annual, by date or by year and index", () => {
  const may = resolvePeriod({ period: "month", year: 2024, index: 5 });
  assert.equal(may.label, "May 2024");
  assert.equal(may.previous.label, "April 2024");
  assert.equal(may.slug, "2024-05");
  assert.deepEqual(resolvePeriod({ period: "month", date: "2024-05-17" }).label, "May 2024");

  const q2 = resolvePeriod({ period: "quarter", date: "2024-05-17" });
  assert.equal(iso(q2.from), "2024-04-01");
  assert.equal(iso(q2.to), "2024-07-01");
  assert.equal(q2.label, "Q2 2024 (Apr – Jun)");

  const h2 = resolvePeriod({ period: "half", year: 2024, index: 2 });
  assert.equal(iso(h2.lastDay), "2024-12-31");
  assert.equal(h2.label, "Second half 2024 (Jul – Dec)");

  const year = resolvePeriod({ period: "year", year: 2024 });
  assert.equal(year.days, 366);
  assert.equal(year.previous.label, "Year 2023");
});

test("the first period of a year compares with the last one of the year before", () => {
  assert.equal(resolvePeriod({ period: "month", year: 2024, index: 1 }).previous.label, "December 2023");
  assert.equal(resolvePeriod({ period: "quarter", year: 2024, index: 1 }).previous.label, "Q4 2023 (Oct – Dec)");
  assert.equal(resolvePeriod({ period: "half", year: 2024, index: 1 }).previous.label, "Second half 2023 (Jul – Dec)");
  assert.equal(resolvePeriod({ period: "week", date: "2026-01-01" }).previous.label, "Week 22–28 Dec 2025");
});

test("custom ranges are inclusive and compare with the same length before", () => {
  const r = resolvePeriod({ period: "custom", from: "2026-11-01", to: "2026-11-15" });
  assert.equal(r.days, 15);
  assert.equal(r.label, "01–15 Nov 2026");
  assert.equal(iso(r.previous.from), "2026-10-17");
  assert.equal(iso(r.previous.lastDay), "2026-10-31");
});

test("a past period is reported as at its last day", () => {
  assert.equal(iso(resolvePeriod({ period: "month", year: 2024, index: 6 }).asAt), "2024-06-30");
});

test("breakdown: by day up to two months, by month beyond", () => {
  const month = resolvePeriod({ period: "month", year: 2024, index: 2 });
  assert.equal(month.bucket, "day");
  assert.equal(bucketsOf(month).length, 29);
  const half = resolvePeriod({ period: "half", year: 2024, index: 1 });
  assert.deepEqual(bucketsOf(half).map((b) => b.label), ["January", "February", "March", "April", "May", "June"]);
  // A custom range across a year end clips the first and last months.
  const custom = resolvePeriod({ period: "custom", from: "2025-11-15", to: "2026-02-10" });
  const buckets = bucketsOf(custom);
  assert.deepEqual(buckets.map((b) => b.label), ["Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026"]);
  assert.equal(iso(buckets[0].from), "2025-11-15");
  assert.equal(iso(buckets[3].to), "2026-02-11");
});

test("a period still running lists no days or months to come", () => {
  const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date())}T00:00:00.000Z`);
  const month = resolvePeriod({ period: "month" });
  assert.equal(bucketsOf(month).length, today.getUTCDate());
  assert.equal(iso(bucketsOf(month).at(-1).from), iso(today));
  const year = resolvePeriod({ period: "year" });
  assert.equal(bucketsOf(year).length, today.getUTCMonth() + 1);
});

test("bad periods are rejected", () => {
  assert.throws(() => resolvePeriod({ period: "decade" }));
  assert.throws(() => resolvePeriod({ period: "month", year: 2024, index: 13 }));
  assert.throws(() => resolvePeriod({ period: "day", date: "2026-02-30" }));
  assert.throws(() => resolvePeriod({ period: "month", year: 1990, index: 1 }));
  assert.throws(() => resolvePeriod({ period: "custom", from: "2026-11-10", to: "2026-11-01" }));
  assert.throws(() => resolvePeriod({ period: "custom", from: "2024-01-01", to: "2025-06-30" }));
});

test("date spans read naturally", () => {
  assert.equal(spanText(day("2026-11-08"), day("2026-11-08")), "08 Nov 2026");
  assert.equal(spanText(day("2025-12-29"), day("2026-01-04")), "29 Dec 2025 – 04 Jan 2026");
});
