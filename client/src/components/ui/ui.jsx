import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, CircleAlert, Inbox, Info, Loader2, X, XCircle } from "lucide-react";

import { cx } from "../../lib/cx";



// =====================================================================
// Buttons
// =====================================================================
const BUTTON = {
  primary: "bg-primary-700 text-white shadow-sm hover:bg-primary-800 active:bg-primary-900 disabled:bg-primary-300 disabled:shadow-none",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-400 disabled:hover:bg-white",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400",
  subtle: "bg-primary-50 text-primary-800 hover:bg-primary-100",
  link: "px-0 py-0 text-primary-700 hover:text-primary-900 hover:underline",
};
const BUTTON_SIZE = {
  xs: "h-7 gap-1.5 rounded-md px-2 text-xs",
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-[13px]",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm",
  lg: "h-11 gap-2 rounded-lg px-5 text-sm",
};
const ICON_SIZE = { xs: 13, sm: 15, md: 16, lg: 18 };

export const Button = ({ variant = "primary", size = "md", loading = false, icon: Icon, className, children, disabled, ...props }) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={cx(
      "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 disabled:cursor-not-allowed",
      variant !== "link" && BUTTON_SIZE[size],
      !children && variant !== "link" && (size === "sm" || size === "xs" ? "w-8 px-0" : "w-9 px-0"),
      BUTTON[variant],
      className,
    )}
    {...props}
  >
    {loading ? <Loader2 size={ICON_SIZE[size]} className="animate-spin" aria-hidden /> : Icon ? <Icon size={ICON_SIZE[size]} aria-hidden /> : null}
    {children}
  </button>
);

// =====================================================================
// Modal: focus moves in on open, Tab stays inside, focus returns on close.
// =====================================================================
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = ({ open, title, subtitle, onClose, children, footer, size = "md", icon: Icon, tone }) => {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current?.();
      }
      if (event.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const body = panel.current?.querySelector("[data-modal-body]");
    (body?.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") || panel.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  if (!open) return null;
  const width = { sm: "sm:max-w-md", md: "sm:max-w-2xl", lg: "sm:max-w-4xl", xl: "sm:max-w-6xl" }[size];
  // Portal to <body> so parent layout (spacing, overflow, transforms) never shifts the overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] animate-fade-in sm:items-start sm:p-6 sm:pt-[8vh]"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx("flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-overlay outline-none animate-pop-in sm:max-h-[84vh] sm:rounded-2xl", width)}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          {Icon && <span className={cx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-primary-50 text-primary-700")}><Icon size={18} /></span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-1.5 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div data-modal-body className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

// =====================================================================
// Form controls
// =====================================================================
const CONTROL =
  "w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500 disabled:shadow-none";

export const Label = ({ htmlFor, children, required }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-slate-700">
    {children}
    {required && <span className="ml-0.5 text-rose-600" aria-hidden>*</span>}
  </label>
);

// `tall` gives the 40px height used inside forms; toolbars and filters stay at 36px.
export const Input = ({ className, tall, ...props }) => <input className={cx(CONTROL, tall ? "h-10" : "h-9", className)} {...props} />;
// eslint-disable-next-line no-unused-vars
export const Textarea = ({ className, tall, ...props }) => <textarea rows={3} className={cx(CONTROL, "py-2 leading-relaxed", className)} {...props} />;
export const Select = ({ className, tall, options = [], placeholder = "Select...", ...props }) => (
  <select className={cx(CONTROL, "select-chevron cursor-pointer pr-9", tall ? "h-10" : "h-9", className)} {...props}>
    <option value="">{placeholder}</option>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

export const FieldWrap = ({ label, htmlFor, required, help, error, children, className }) => (
  <div className={className}>
    {label && <Label htmlFor={htmlFor} required={required}>{label}</Label>}
    {children}
    {help && !error && <p id={htmlFor ? `${htmlFor}-help` : undefined} className="mt-1.5 text-xs leading-relaxed text-slate-500">{help}</p>}
    {error && (
      <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 flex items-start gap-1 text-xs font-medium text-rose-700 animate-fade-in">
        <CircleAlert size={13} className="mt-px shrink-0" aria-hidden />
        {error}
      </p>
    )}
  </div>
);

// =====================================================================
// Feedback
// =====================================================================
const ALERT = {
  error: ["border-rose-200 bg-rose-50 text-rose-800", XCircle, "text-rose-600"],
  success: ["border-emerald-200 bg-emerald-50 text-emerald-800", CheckCircle2, "text-emerald-600"],
  info: ["border-sky-200 bg-sky-50 text-sky-800", Info, "text-sky-600"],
  warning: ["border-amber-200 bg-amber-50 text-amber-900", AlertTriangle, "text-amber-600"],
};

export const Alert = ({ tone = "info", children, onClose, className }) => {
  if (!children) return null;
  const [style, Icon, iconColor] = ALERT[tone] || ALERT.info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm animate-slide-down", style, className)}>
      <Icon size={17} className={cx("mt-px shrink-0", iconColor)} aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {onClose && <button type="button" aria-label="Dismiss" onClick={onClose} className="-m-1 rounded p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"><X size={15} /></button>}
    </div>
  );
};

export const Spinner = ({ label = "Loading...", className }) => (
  <div role="status" className={cx("flex items-center justify-center gap-2 py-12 text-sm text-slate-500", className)}>
    <Loader2 size={18} className="animate-spin text-primary-600" aria-hidden />
    {label}
  </div>
);

export const Skeleton = ({ className }) => <div aria-hidden className={cx("animate-pulse rounded-md bg-slate-200/70", className)} />;

export const EmptyState = ({ title = "Nothing here yet", icon: Icon = Inbox, children, action }) => (
  <div className="flex flex-col items-center px-4 py-14 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon size={22} aria-hidden /></span>
    <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
    {children && <p className="mt-1 max-w-sm text-sm text-slate-500">{children}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// =====================================================================
// Layout pieces
// =====================================================================
export const PageHeader = ({ title, description, actions, icon: Icon, eyebrow }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="flex min-w-0 items-start gap-3.5">
      {Icon && (
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white shadow-sm sm:flex">
          <Icon size={22} aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        {eyebrow && <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-primary-700">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const Card = ({ className, children, ...props }) => (
  <section className={cx("rounded-xl border border-slate-200 bg-white shadow-card", className)} {...props}>{children}</section>
);

export const CardHeader = ({ title, description, actions, icon: Icon, className }) => (
  <div className={cx("flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", className)}>
    <div className="flex min-w-0 items-start gap-2.5">
      {Icon && <Icon size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />}
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

const BADGE = {
  green: ["bg-emerald-50 text-emerald-800 ring-emerald-600/20", "bg-emerald-500"],
  amber: ["bg-amber-50 text-amber-800 ring-amber-600/25", "bg-amber-500"],
  red: ["bg-rose-50 text-rose-800 ring-rose-600/20", "bg-rose-500"],
  blue: ["bg-sky-50 text-sky-800 ring-sky-600/20", "bg-sky-500"],
  gray: ["bg-slate-100 text-slate-700 ring-slate-500/20", "bg-slate-400"],
};
const STATUS_TONE = {
  with_finance: "amber", filled: "green", shortlisted: "blue", interview: "amber", passed: "blue", hired: "green",
  active: "green", approved: "blue", paid: "green", received: "green", reconciled: "green", fulfilled: "green", recovered: "green", milking: "green", cleared: "green", closed: "gray",
  pending: "amber", draft: "amber", sent: "amber", dispatched: "amber", returned: "amber", partial: "amber", partially_received: "amber", ordered: "blue", open: "amber", under_treatment: "amber", credit: "red", awaiting_fertiliser: "amber",
  rejected: "red", declined: "red", issued: "green", cancelled: "gray", voided: "gray", terminated: "red", resigned: "gray", retired: "gray", dead: "red", died: "red", inactive: "gray", suspended: "red", sold: "gray", culled: "gray", dry: "gray", succeeded: "gray", deceased: "gray", expired: "gray", posted: "green",
};

/** Status pill: dot + label, so state never relies on colour alone. */
export const Badge = ({ tone, value, children, className }) => {
  const [style, dot] = BADGE[tone || STATUS_TONE[value] || "gray"];
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", style, className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      {children}
    </span>
  );
};

export const Kbd = ({ children }) => (
  <kbd className="rounded border border-slate-300 bg-white px-1.5 py-px font-sans text-[11px] font-medium text-slate-500 shadow-sm">{children}</kbd>
);
