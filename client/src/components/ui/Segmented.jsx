import { cx } from "../../lib/cx";

/** A row of mutually exclusive choices (e.g. Daily / Weekly / Monthly). */
export const Segmented = ({ label, options, value, onChange, className }) => (
  <div role="group" aria-label={label} className={cx("inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5", className)}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        aria-pressed={value === o.value}
        onClick={() => onChange(o.value)}
        className={cx(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50",
          value === o.value ? "bg-white text-primary-800 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900",
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);
