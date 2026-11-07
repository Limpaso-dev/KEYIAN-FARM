/** The cooperative works on Nairobi time (EAT, UTC+3), whatever the device clock's zone. */
export const TIME_ZONE = "Africa/Nairobi";

/** Current hour (0-23) in Nairobi. */
export const nairobiHour = () =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE }).format(new Date()));

/** Today's date in Nairobi as YYYY-MM-DD. */
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

export const greeting = (hour = nairobiHour()) =>
  hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

export const daysAgo = (days) => {
  const date = new Date(`${today()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

export const money = (value) =>
  value === null || value === undefined || value === ""
    ? ""
    : `KES ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const number = (value, digits = 2) =>
  value === null || value === undefined || value === "" ? "" : Number(value).toLocaleString("en-KE", { maximumFractionDigits: digits });

/** Dates from the API are UTC midnight for calendar dates; show them as such. */
export const date = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
};

export const dateTime = (value) =>
  value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }) : "";

/** Value for an <input type="date"> from an API date. */
export const inputDate = (value) => (value ? String(value).slice(0, 10) : "");

export const fullName = (person) => (person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() : "");

export const titleCase = (value) =>
  String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** 1,284 / 12.9K / 4.2M - for tiles and chart axes; full values belong in tooltips and tables. */
export const compact = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs < 10000) return n.toLocaleString("en-KE", { maximumFractionDigits: abs < 100 ? 1 : 0 });
  const [div, suffix] = abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  return `${(n / div).toLocaleString("en-KE", { maximumFractionDigits: Math.abs(n / div) < 100 ? 1 : 0 })}${suffix}`;
};

export const compactMoney = (value) => `KES ${compact(value)}`;

/** The last `days` calendar dates in Nairobi, oldest first, as YYYY-MM-DD. */
export const lastDays = (days) => Array.from({ length: days }, (_, i) => daysAgo(days - 1 - i));

/** "7 Nov" from YYYY-MM-DD or an API date. */
export const shortDate = (value) =>
  value ? new Date(`${String(value).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";

/** "Sat" from YYYY-MM-DD. */
export const weekday = (value) =>
  value ? new Date(`${String(value).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }) : "";

/** "5 minutes ago", "yesterday", or a date. */
export const timeAgo = (value) => {
  if (!value) return "";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date(value);
};
