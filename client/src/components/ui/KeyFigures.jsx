import { AlertTriangle } from "lucide-react";
import { cx } from "../../lib/cx";
import { dateTime } from "../../lib/format";

const VALUE_TONE = { bad: "text-rose-700", warn: "text-amber-700" };

/**
 * Key figures as one ruled band - label over value, hairlines between - in
 * place of a row of cards. Used by every report and department summary.
 *
 * items: [{ label, value, hint?, tone?: "bad" | "warn" }]
 * columns: 3 or 4 at tablet width and up
 * bare: no rules above and below (when the band sits directly in a card)
 */
export const KeyFigures = ({ items, columns = 4, bare = false, className }) => {
  // Fill the last row so the hairline grid has no gaps.
  const blanks = (columns - (items.length % columns)) % columns;
  return (
    <dl
      className={cx(
        "grid gap-px bg-slate-200",
        columns === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
        !bare && "border-y border-slate-200",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-white px-4 py-3">
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <span className="truncate">{item.label}</span>
            {item.tone === "warn" && <AlertTriangle size={12} className="shrink-0 text-amber-600" aria-label="Needs attention" />}
          </dt>
          <dd className={cx("mt-1 truncate text-lg font-semibold tabular-nums tracking-tight text-slate-900", VALUE_TONE[item.tone])}>{item.value}</dd>
          {item.hint && <dd className="mt-0.5 truncate text-xs text-slate-500">{item.hint}</dd>}
        </div>
      ))}
      {Array.from({ length: blanks }, (_, i) => <div key={`blank-${i}`} className={cx("bg-white", columns === 3 ? "hidden sm:block" : "")} aria-hidden />)}
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
