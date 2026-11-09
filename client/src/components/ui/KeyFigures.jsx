import { AlertTriangle } from "lucide-react";
import { cx } from "../../lib/cx";
import { dateTime } from "../../lib/format";
import { Skeleton } from "./ui";

const VALUE_TONE = { bad: "text-rose-700", warn: "text-amber-700" };
const MD_COLUMNS = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5", 6: "md:grid-cols-6" };
const SIZES = {
  md: { cell: "py-3 pr-4", inset: "pl-4", mdInset: "md:pl-4", value: "mt-1 text-lg" },
  lg: { cell: "py-4 pr-5", inset: "pl-5", mdInset: "md:pl-5", value: "mt-1.5 text-[1.75rem] leading-9" },
};

/**
 * Hairlines between figures - two to a row on phones, up to four in a row
 * from tablets up - and the first figure of each row flush with the page, in
 * line with the headings and tables around it.
 */
const edges = (i, perRow, style) => cx(
  "border-slate-200",
  i >= 2 && (i >= perRow ? "border-t" : "border-t md:border-t-0"),
  i % 2 === 1 ? (i % perRow === 0 ? "border-l md:border-l-0" : "border-l") : i % perRow !== 0 && "md:border-l",
  i % 2 === 0 ? "pl-0" : style.inset,
  i % perRow === 0 ? "md:pl-0" : style.mdInset,
);

/**
 * Key figures as a ruled strip on the page - label, figure, a line of
 * context - with hairlines between them: no boxes, no rounded corners. The
 * dashboard and the department summaries all use it.
 *
 * items: [{ label, value, hint?, tone?: "bad" | "warn", title? }]
 * size: "md" on department pages, "lg" for the dashboard's headline figures
 * loading: the number of placeholder figures to show while loading
 * columns: the most figures to a row from tablet width up (4, or up to 6)
 */
export const KeyFigures = ({ items = [], size = "md", loading = 0, columns = 4, className }) => {
  const count = loading || items.length;
  if (!count) return null;
  const perRow = Math.min(count, columns);
  const style = SIZES[size];
  return (
    <dl className={cx("grid border-y border-slate-200", count === 1 ? "grid-cols-1" : "grid-cols-2", MD_COLUMNS[perRow], className)}>
      {loading
        ? Array.from({ length: loading }, (_, i) => (
          <div key={i} className={cx("space-y-2.5", style.cell, edges(i, perRow, style))} aria-hidden>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))
        : items.map((item, i) => (
          <div key={item.label} title={item.title} className={cx("min-w-0", style.cell, edges(i, perRow, style))}>
            <dt className="flex items-start gap-1.5 text-[11px] font-semibold uppercase leading-4 tracking-wider text-slate-500">
              <span>{item.label}</span>
              {item.tone === "warn" && <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" aria-label="Needs attention" />}
            </dt>
            <dd className={cx("truncate font-semibold tabular-nums tracking-tight", style.value, VALUE_TONE[item.tone] || "text-slate-900")}>{item.value}</dd>
            {item.hint && <dd className="mt-1 truncate text-xs text-slate-500">{item.hint}</dd>}
          </div>
        ))}
    </dl>
  );
};

/** Closing line of every report: it was produced by the system, and when. */
export const SystemNote = ({ generatedAt, className }) => (
  <div className={cx("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500", className)}>
    <span className="italic">This is a system generated report.</span>
    <span className="tabular-nums">Generated {dateTime(generatedAt || new Date())} EAT</span>
  </div>
);
