import { today } from "./format";

// Reporting periods, matching the API (server/src/lib/periods.js).
// A selection is { period, date } - any day inside the period (for two
// weeks, any day of the first week) - or { period: "custom", from, to }.

export const PERIOD_OPTIONS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "fortnight", label: "2 weeks" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "half", label: "Half-yearly" },
  { value: "year", label: "Annual" },
  { value: "custom", label: "Custom" },
];

const MONTHS_IN = { month: 1, quarter: 3, half: 6, year: 12 };
const DAY_MS = 86400000;
const parse = (iso) => new Date(`${iso}T00:00:00Z`);
const iso = (date) => date.toISOString().slice(0, 10);
const addDays = (isoDate, days) => iso(new Date(parse(isoDate).getTime() + days * DAY_MS));
const mondayOf = (isoDate) => addDays(isoDate, -((parse(isoDate).getUTCDay() + 6) % 7));

/** The first day of the period of this kind that contains the date. */
export const periodStart = (period, isoDate) => {
  if (period === "day" || period === "custom") return isoDate;
  if (period === "week" || period === "fortnight") return mondayOf(isoDate);
  const d = parse(isoDate);
  const months = MONTHS_IN[period];
  return iso(new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / months) * months, 1)));
};

/** The same kind of period, one earlier (-1) or one later (+1). */
export const shiftPeriod = (value, direction) => {
  const { period, date } = value;
  if (period === "day") return { ...value, date: addDays(date, direction) };
  if (period === "week") return { ...value, date: addDays(mondayOf(date), 7 * direction) };
  if (period === "fortnight") return { ...value, date: addDays(mondayOf(date), 14 * direction) };
  const start = parse(periodStart(period, date));
  return { ...value, date: iso(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + MONTHS_IN[period] * direction, 1))) };
};

/** True when the next period would start after today. */
export const isLatestPeriod = (value) => value.period === "custom" || periodStart(value.period, shiftPeriod(value, 1).date) > today();

const lastDayOf = (value) => (value.period === "custom" ? value.to : addDays(periodStart(value.period, shiftPeriod(value, 1).date), -1));

/**
 * Switch to another kind of period around the same dates: May 2024 becomes
 * Q2 2024 or the week of 1 May. Two weeks end with the current week rather
 * than run into next week; a custom range starts as the period on screen.
 */
export const switchPeriod = (value, period) => {
  const now = today();
  if (period === "custom") {
    const from = value.period === "custom" ? value.from : periodStart(value.period, value.date);
    const last = lastDayOf(value);
    const to = last > now ? (now >= from ? now : from) : last;
    return { period, date: value.date || from, from, to };
  }
  let date = value.period === "custom" ? value.from : value.date;
  if (period === "fortnight" && mondayOf(date) === mondayOf(now)) date = addDays(date, -7);
  return { period, date };
};

/** Query parameters for the report APIs. */
export const periodParams = (value) => (value.period === "custom"
  ? { period: "custom", from: value.from, to: value.to }
  : { period: value.period, date: value.date });
