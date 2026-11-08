import { badRequest } from "./http.js";

// Reporting periods. Reports can be asked for a single day (urgent reports),
// a week, two weeks, a month, a quarter, a half year, a year, or any custom
// range. Calendar dates are stored as UTC midnight, so all the arithmetic
// here is in UTC; "today" is the date in Nairobi.
//
// A period object:
//   period      "day" | "week" | "fortnight" | "month" | "quarter" | "half" | "year" | "custom"
//   from, to    first day, and the day after the last (to is exclusive)
//   lastDay     the last day
//   asAt        the end of the period, or today while the period is running
//   days        number of days covered
//   label       "November 2026", "Week 03–09 Nov 2026", "Q4 2026 (Oct – Dec)" ...
//   shortLabel  "Nov 2026", "Q4 2026" ... (used in "change vs ...")
//   rangeText   "01–30 Nov 2026"
//   slug        for file names: "2026-11", "2026-Q4", "week-2026-11-03" ...
//   yearStart   1 January of the year the period ends in
//   bucket      "day" or "month": how the period is broken down in tables
//   previous    the period just before, of the same length

export const PERIODS = ["day", "week", "fortnight", "month", "quarter", "half", "year", "custom"];
const DAY_MS = 86400000;
const MAX_CUSTOM_DAYS = 366;
// Periods up to this many days are broken down day by day, longer ones by month.
const DAILY_BREAKDOWN_MAX_DAYS = 62;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
// Calendar periods: [periods in a year, months in each]
const SPANS = { month: [12, 1], quarter: [4, 3], half: [2, 6], year: [1, 12] };

const utc = (year, month, day = 1) => new Date(Date.UTC(year, month, day));
export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
export const isoDay = (date) => date.toISOString().slice(0, 10);
const two = (n) => String(n).padStart(2, "0");

/** Today's date in Nairobi, as UTC midnight. */
export const nairobiToday = (now = new Date()) =>
  new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now)}T00:00:00.000Z`);

/** "08 Nov 2026" */
export const dayText = (date) => `${two(date.getUTCDate())} ${SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

/** "03–09 Nov 2026", "27 Oct – 09 Nov 2026", "29 Dec 2026 – 04 Jan 2027" */
export const spanText = (from, last) => {
  if (isoDay(from) === isoDay(last)) return dayText(from);
  const sameYear = from.getUTCFullYear() === last.getUTCFullYear();
  if (sameYear && from.getUTCMonth() === last.getUTCMonth()) return `${two(from.getUTCDate())}–${dayText(last)}`;
  if (sameYear) return `${two(from.getUTCDate())} ${SHORT[from.getUTCMonth()]} – ${dayText(last)}`;
  return `${dayText(from)} – ${dayText(last)}`;
};

const mondayOf = (date) => addDays(date, -((date.getUTCDay() + 6) % 7));

/** [from, to) of the period of this kind that contains `anchor`. A two-week period starts on the Monday of the anchor's week. */
const bounds = (period, anchor) => {
  if (period === "day") return [anchor, addDays(anchor, 1)];
  if (period === "week" || period === "fortnight") {
    const from = mondayOf(anchor);
    return [from, addDays(from, period === "week" ? 7 : 14)];
  }
  const months = SPANS[period][1];
  const start = Math.floor(anchor.getUTCMonth() / months) * months;
  return [utc(anchor.getUTCFullYear(), start), utc(anchor.getUTCFullYear(), start + months)];
};

const describe = (period, from, last) => {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const span = spanText(from, last);
  switch (period) {
    case "day": return { label: dayText(from), shortLabel: dayText(from), slug: isoDay(from) };
    case "week": return { label: `Week ${span}`, shortLabel: `week ${span}`, slug: `week-${isoDay(from)}` };
    case "fortnight": return { label: `Fortnight ${span}`, shortLabel: span, slug: `fortnight-${isoDay(from)}` };
    case "month": return { label: `${MONTHS[month]} ${year}`, shortLabel: `${SHORT[month]} ${year}`, slug: isoDay(from).slice(0, 7) };
    case "quarter": {
      const q = month / 3 + 1;
      return { label: `Q${q} ${year} (${SHORT[month]} – ${SHORT[month + 2]})`, shortLabel: `Q${q} ${year}`, slug: `${year}-Q${q}` };
    }
    case "half": {
      const h = month / 6 + 1;
      return { label: `${h === 1 ? "First" : "Second"} half ${year} (${SHORT[month]} – ${SHORT[month + 5]})`, shortLabel: `H${h} ${year}`, slug: `${year}-H${h}` };
    }
    case "year": return { label: `Year ${year}`, shortLabel: String(year), slug: String(year) };
    default: return { label: span, shortLabel: span, slug: `${isoDay(from)}-to-${isoDay(last)}` };
  }
};

const build = (period, from, to, withPrevious = true) => {
  const lastDay = addDays(to, -1);
  const today = nairobiToday();
  const days = Math.round((to - from) / DAY_MS);
  let asAt = lastDay < today ? lastDay : today;
  if (asAt < from) asAt = from;
  const range = {
    period,
    from,
    to,
    lastDay,
    asAt,
    days,
    ...describe(period, from, lastDay),
    rangeText: spanText(from, lastDay),
    yearStart: utc(lastDay.getUTCFullYear(), 0),
    bucket: days > DAILY_BREAKDOWN_MAX_DAYS ? "month" : "day",
  };
  if (withPrevious) {
    range.previous = period === "custom" ? build("custom", addDays(from, -days), from, false)
      : period === "fortnight" ? build("fortnight", addDays(from, -14), from, false)
        : build(period, ...bounds(period, addDays(from, -1)), false);
  }
  return range;
};

const parseDay = (value, name) => {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw badRequest(`${name} must be in the form YYYY-MM-DD`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || isoDay(date) !== text) throw badRequest(`${name} is not a valid date`);
  if (date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) throw badRequest(`${name} must be between 2000 and 2100`);
  return date;
};

/**
 * The period a request asks for:
 *   period=day|week|fortnight|month|quarter|half|year with date=YYYY-MM-DD
 *     (any day inside the period; for two weeks, any day of the first week)
 *   period=month|quarter|half|year with year=2024&index=5 (index: month, quarter or half number)
 *   period=custom with from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, at most 366 days)
 * Without a date, the period containing today.
 */
export const resolvePeriod = (query = {}) => {
  const period = String(query.period || "day");
  if (!PERIODS.includes(period)) throw badRequest(`Period must be one of: ${PERIODS.join(", ")}`);

  if (period === "custom") {
    const from = parseDay(query.from, "Start date");
    const last = parseDay(query.to, "End date");
    if (last < from) throw badRequest("The end date must be on or after the start date");
    if (Math.round((last - from) / DAY_MS) + 1 > MAX_CUSTOM_DAYS) throw badRequest(`A custom range can cover at most ${MAX_CUSTOM_DAYS} days`);
    return build("custom", from, addDays(last, 1));
  }

  if (SPANS[period] && query.year != null && query.year !== "") {
    const year = Number(query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest("Choose a valid year");
    const [count, months] = SPANS[period];
    const index = period === "year" ? 1 : Number(query.index ?? 1);
    if (!Number.isInteger(index) || index < 1 || index > count) throw badRequest(`Choose a ${period} between 1 and ${count}`);
    return build(period, ...bounds(period, utc(year, (index - 1) * months)));
  }

  const anchor = query.date ? parseDay(query.date, "Date") : nairobiToday();
  return build(period, ...bounds(period, anchor));
};

/**
 * The rows of a breakdown table: one per day, or one per month for long
 * periods (months clipped to the period at either end). A period that is
 * still running stops at today - no rows for days or months to come.
 */
export const bucketsOf = (range) => {
  const until = range.asAt < range.lastDay ? addDays(range.asAt, 1) : range.to;
  if (range.bucket === "day") {
    return Array.from({ length: Math.max(1, Math.round((until - range.from) / DAY_MS)) }, (_, i) => {
      const from = addDays(range.from, i);
      return { key: isoDay(from), label: dayText(from), from, to: addDays(from, 1) };
    });
  }
  const multiYear = range.from.getUTCFullYear() !== range.lastDay.getUTCFullYear();
  const buckets = [];
  let year = range.from.getUTCFullYear();
  let month = range.from.getUTCMonth();
  while (utc(year, month) < until || !buckets.length) {
    const start = utc(year, month);
    const end = utc(year, month + 1);
    buckets.push({
      key: isoDay(start).slice(0, 7),
      label: multiYear ? `${SHORT[month]} ${year}` : MONTHS[month],
      from: start < range.from ? range.from : start,
      to: end > range.to ? range.to : end,
    });
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return buckets;
};

/** What the client needs to show and step through a period. */
export const periodInfo = (range) => ({
  period: range.period,
  label: range.label,
  rangeText: range.rangeText,
  from: isoDay(range.from),
  to: isoDay(range.lastDay),
  asAt: isoDay(range.asAt),
  days: range.days,
  slug: range.slug,
  previous: range.previous?.label,
});
