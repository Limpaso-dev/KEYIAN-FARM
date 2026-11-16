import { date, money, number } from "../../lib/format";

// How a report's figures read: on screen, printed and (from the server) in
// the PDF.

export const NUMERIC = ["money", "number", "percent"];
export const SIGN_OFF = ["Prepared by", "Checked by", "Confirmed by"];

const amount = (value) => Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const cell = (value, type) => {
  if (value === "" || value == null) return "";
  if (type === "percent") return `${number(value)}%`;
  if (type === "money") return amount(value);
  if (type === "number") return number(value);
  if (type === "date") return date(value);
  return value;
};

export const alignRight = (column) => column.align === "right" || NUMERIC.includes(column.type);

// Shortfalls and falls read in red, as on a paper report.
export const isNegative = (value, column) => alignRight(column) && (typeof value === "number" ? value < 0 : /^(KES )?-\d/.test(String(value ?? "")));

export const summaryText = (item) => {
  if (item.type === "money") return money(item.value);
  if (item.type === "percent") return `${number(item.value)}%`;
  if (item.type === "text") return item.value;
  return number(item.value);
};

/** The Summary across the page: two item/value pairs a row, read down the left pair, then the right. */
export const summaryGrid = (report) => {
  const half = Math.ceil(report.summary.length / 2);
  return {
    title: "Summary",
    pairs: true,
    columns: [
      { key: "item", label: "Item" }, { key: "value", label: "Value", align: "right" },
      { key: "item2", label: "Item" }, { key: "value2", label: "Value", align: "right" },
    ],
    rows: Array.from({ length: half }, (_, i) => {
      const [left, right] = [report.summary[i], report.summary[i + half]];
      return { item: left.label, value: summaryText(left), item2: right?.label ?? "", value2: right ? summaryText(right) : "" };
    }),
  };
};

/** A report's tables in order: the Summary (when it has figures), then its sections. */
export const tablesOf = (report) => [...(report.summary?.length ? [summaryGrid(report)] : []), ...report.sections];
