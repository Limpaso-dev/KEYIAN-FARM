import { useEffect, useId, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";

const cx = (...classes) => classes.filter(Boolean).join(" ");

// ---------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------
const BUTTON = {
  primary: "bg-primary-700 text-white hover:bg-primary-800 disabled:bg-primary-300",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-rose-700 text-white hover:bg-rose-800 disabled:bg-rose-300",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  link: "text-primary-700 hover:text-primary-900 hover:underline px-0 py-0",
};

export const Button = ({ variant = "primary", size = "md", loading = false, icon: Icon, className, children, disabled, ...props }) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={cx(
      "inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed",
      size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
      BUTTON[variant],
      className,
    )}
    {...props}
  >
    {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={size === "sm" ? 14 : 16} /> : null}
    {children}
  </button>
);

// ---------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------
export const Modal = ({ open, title, subtitle, onClose, children, footer, size = "md" }) => {
  const panel = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector("input, select, textarea, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-3 sm:p-6" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx("my-4 w-full rounded-xl bg-white shadow-2xl sm:my-10", width)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------
const CONTROL = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-400/20 disabled:bg-slate-100 disabled:text-slate-500";

export const Label = ({ htmlFor, children, required }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-slate-700">
    {children}
    {required && <span className="ml-0.5 text-rose-600">*</span>}
  </label>
);

export const Input = ({ className, ...props }) => <input className={cx(CONTROL, className)} {...props} />;
export const Textarea = ({ className, ...props }) => <textarea rows={3} className={cx(CONTROL, className)} {...props} />;
export const Select = ({ className, options = [], placeholder = "Select...", ...props }) => (
  <select className={cx(CONTROL, className)} {...props}>
    <option value="">{placeholder}</option>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

export const FieldWrap = ({ label, htmlFor, required, help, error, children, className }) => (
  <div className={className}>
    {label && <Label htmlFor={htmlFor} required={required}>{label}</Label>}
    {children}
    {help && !error && <p className="mt-1 text-xs text-slate-500">{help}</p>}
    {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
  </div>
);

// ---------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------
const ALERT = {
  error: ["border-rose-200 bg-rose-50 text-rose-800", AlertTriangle],
  success: ["border-emerald-200 bg-emerald-50 text-emerald-800", CheckCircle2],
  info: ["border-sky-200 bg-sky-50 text-sky-800", Info],
  warning: ["border-amber-200 bg-amber-50 text-amber-800", AlertTriangle],
};

export const Alert = ({ tone = "info", children, onClose, className }) => {
  if (!children) return null;
  const [style, Icon] = ALERT[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm", style, className)}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && <button type="button" aria-label="Dismiss" onClick={onClose} className="opacity-60 hover:opacity-100"><X size={15} /></button>}
    </div>
  );
};

export const Spinner = ({ label = "Loading..." }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />{label}</div>
);

export const EmptyState = ({ title = "Nothing here yet", children }) => (
  <div className="px-4 py-12 text-center">
    <p className="text-sm font-medium text-slate-700">{title}</p>
    {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
  </div>
);

// ---------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------
export const PageHeader = ({ title, description, actions }) => (
  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const Card = ({ className, children }) => (
  <section className={cx("rounded-xl border border-[#dfe8dc] bg-white shadow-sm", className)}>{children}</section>
);

export const StatCard = ({ label, value, hint, tone = "default" }) => (
  <div className={cx("rounded-lg border px-4 py-3", tone === "warn" ? "border-amber-200 bg-amber-50" : "border-[#dfe8dc] bg-white")}>
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
  </div>
);

export const Tabs = ({ tabs, active, onChange }) => (
  <div className="mb-4 overflow-x-auto border-b border-slate-200">
    <div role="tablist" className="flex min-w-max gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cx(
            "-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition",
            active === tab.key ? "border-primary-700 text-primary-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);

const BADGE = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
};
const STATUS_TONE = {
  active: "green", approved: "blue", paid: "green", received: "green", reconciled: "green", fulfilled: "green", recovered: "green", milking: "green", cleared: "green", closed: "gray",
  pending: "amber", draft: "amber", sent: "amber", dispatched: "amber", returned: "amber", partial: "amber", partially_received: "amber", ordered: "blue", open: "amber", under_treatment: "amber", credit: "red", awaiting_fertiliser: "amber",
  rejected: "red", cancelled: "gray", voided: "gray", terminated: "red", resigned: "gray", retired: "gray", dead: "red", died: "red", inactive: "gray", suspended: "red", sold: "gray", culled: "gray", dry: "gray", succeeded: "gray", deceased: "gray", expired: "gray", posted: "green",
};

export const Badge = ({ tone, value, children }) => (
  <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", BADGE[tone || STATUS_TONE[value] || "gray"])}>
    {children}
  </span>
);
