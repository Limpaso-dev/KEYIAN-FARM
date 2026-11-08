import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Input, Select } from "../ui/ui";
import { Segmented } from "../ui/Segmented";
import { today } from "../../lib/format";
import { isLatestPeriod, PERIOD_OPTIONS, shiftPeriod, switchPeriod } from "../../lib/periods";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i), label: m }));
const QUARTER_OPTIONS = [0, 3, 6, 9].map((m, i) => ({ value: String(m), label: `Q${i + 1} (${SHORT[m]} – ${SHORT[m + 2]})` }));
const HALF_OPTIONS = [{ value: "0", label: "First half (Jan – Jun)" }, { value: "6", label: "Second half (Jul – Dec)" }];
const THIS_YEAR = Number(today().slice(0, 4));

const Field = ({ label, children }) => (
  <label className="block text-xs font-medium text-slate-500">
    {label}
    <div className="mt-1">{children}</div>
  </label>
);

/**
 * Choose a reporting period: a day (for urgent reports), a week, two weeks,
 * a month, a quarter, a half year, a year, or a custom range.
 * value: { period, date } or { period: "custom", from, to }.
 */
export const PeriodPicker = ({ value, onChange }) => {
  const { period } = value;
  const anchor = value.date || value.from || today();
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7)) - 1;
  const years = [...new Set([year, ...Array.from({ length: 11 }, (_, i) => THIS_YEAR - i)])].sort((a, b) => b - a)
    .map((y) => ({ value: String(y), label: String(y) }));
  // Month, quarter, half and year are picked by their first month.
  const firstMonth = period === "quarter" ? Math.floor(month / 3) * 3 : period === "half" ? Math.floor(month / 6) * 6 : period === "year" ? 0 : month;
  const startOf = (y, m) => onChange({ ...value, date: `${y}-${String(m + 1).padStart(2, "0")}-01` });
  const setDate = (key) => (e) => {
    if (!e.target.value) return;
    const next = { ...value, [key]: e.target.value };
    // Keep a custom range the right way round.
    if (key === "from" && next.to < next.from) next.to = next.from;
    if (key === "to" && next.from > next.to) next.from = next.to;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <Segmented label="Report period" options={PERIOD_OPTIONS} value={period} onChange={(p) => onChange(switchPeriod(value, p))} />
      <div className="flex flex-wrap items-end gap-2">
        {period !== "custom" && <Button variant="secondary" icon={ChevronLeft} aria-label="Previous period" title="Previous period" onClick={() => onChange(shiftPeriod(value, -1))} />}
        {period === "day" && <Field label="Date"><Input type="date" value={value.date} onChange={setDate("date")} /></Field>}
        {period === "week" && <Field label="Any day in the week"><Input type="date" value={value.date} onChange={setDate("date")} /></Field>}
        {period === "fortnight" && <Field label="Any day in the first week"><Input type="date" value={value.date} onChange={setDate("date")} /></Field>}
        {period === "month" && <Field label="Month"><Select className="min-w-[150px]" options={MONTH_OPTIONS} value={String(firstMonth)} onChange={(e) => startOf(year, Number(e.target.value))} /></Field>}
        {period === "quarter" && <Field label="Quarter"><Select className="min-w-[170px]" options={QUARTER_OPTIONS} value={String(firstMonth)} onChange={(e) => startOf(year, Number(e.target.value))} /></Field>}
        {period === "half" && <Field label="Half"><Select className="min-w-[190px]" options={HALF_OPTIONS} value={String(firstMonth)} onChange={(e) => startOf(year, Number(e.target.value))} /></Field>}
        {["month", "quarter", "half", "year"].includes(period) && (
          <Field label="Year"><Select options={years} value={String(year)} onChange={(e) => startOf(Number(e.target.value), firstMonth)} /></Field>
        )}
        {period === "custom" && (
          <>
            <Field label="From"><Input type="date" value={value.from} onChange={setDate("from")} /></Field>
            <Field label="To"><Input type="date" value={value.to} onChange={setDate("to")} /></Field>
          </>
        )}
        {period !== "custom" && <Button variant="secondary" icon={ChevronRight} aria-label="Next period" title="Next period" disabled={isLatestPeriod(value)} onClick={() => onChange(shiftPeriod(value, 1))} />}
      </div>
    </div>
  );
};
