export const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

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
  value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

/** Value for an <input type="date"> from an API date. */
export const inputDate = (value) => (value ? String(value).slice(0, 10) : "");

export const fullName = (person) => (person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() : "");

export const titleCase = (value) =>
  String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
