import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, OctagonAlert, X, XCircle } from "lucide-react";

import { currentToasts, dismissError, dismissToast as dismiss, getError, subscribeError, subscribeToasts } from "../../lib/toast";

const STYLE = {
  success: [CheckCircle2, "text-emerald-600", "bg-emerald-500"],
  error: [XCircle, "text-rose-600", "bg-rose-500"],
  info: [Info, "text-sky-600", "bg-sky-500"],
};

/** Success / info confirmations: small cards top-right that fade on their own. */
export const Toaster = () => {
  const items = useSyncExternalStore(subscribeToasts, currentToasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 sm:left-auto sm:right-0 sm:items-end sm:pt-20">
      {items.map((t) => {
        const [Icon, color, bar] = STYLE[t.tone] || STYLE.info;
        return (
          <div key={t.id} role="status" className="pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white py-3 pl-4 pr-3 text-sm text-slate-800 shadow-raised animate-toast-in">
            <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
            <Icon size={18} className={`mt-px shrink-0 ${color}`} aria-hidden />
            <div className="flex-1 font-medium leading-relaxed">{t.message}</div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-m-1 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={15} /></button>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Errors: a centred dialog that stays until closed with the X, the button or
 * Escape. It sits above any open form, which stays as it was underneath.
 */
export const ErrorDialog = () => {
  const error = useSyncExternalStore(subscribeError, getError);
  const okRef = useRef(null);

  useEffect(() => {
    if (!error) return undefined;
    const opener = document.activeElement;
    okRef.current?.focus();
    // Capture phase on window: runs before the form modal's own key handling,
    // so Escape closes only this dialog and Tab stays inside it.
    const onKey = (event) => {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") dismissError();
        else {
          const buttons = [...document.querySelectorAll("[data-error-dialog] button")];
          const next = buttons[(buttons.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length];
          next?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [error]);

  if (!error) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && dismissError()}>
      <div
        data-error-dialog
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-message"
        className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-overlay animate-pop-in"
      >
        <div className="h-1 bg-rose-600" aria-hidden />
        <button type="button" aria-label="Close" onClick={dismissError} className="absolute right-3 top-4 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        <div className="flex gap-4 px-6 pb-5 pt-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-50/50"><OctagonAlert size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1 pr-6">
            <h2 id="error-dialog-title" className="text-base font-semibold text-slate-900">{error.title}</h2>
            <p id="error-dialog-message" className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">{error.message}</p>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-3">
          <button ref={okRef} type="button" onClick={dismissError} className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800">OK, got it</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
