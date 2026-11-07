// A tiny global toast queue: call toast("Saved") from anywhere; <Toaster /> renders it.
let toasts = [];
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());
let nextId = 1;

export const dismissToast = (id) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

export const toast = (message, tone = "success") => {
  if (!message) return;
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, message, tone }];
  emit();
  setTimeout(() => dismissToast(id), tone === "error" ? 7000 : 4000);
};

export const subscribeToasts = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const currentToasts = () => toasts;

// ---------------------------------------------------------------------
// Error dialog: showError("Message") or showError("Message", "Title").
// Errors stay on screen until the person closes them; a newer error
// replaces the one showing.
// ---------------------------------------------------------------------
let currentError = null;
const errorListeners = new Set();

export const showError = (message, title = "Something went wrong") => {
  if (!message) return;
  currentError = { id: nextId++, message, title };
  errorListeners.forEach((listener) => listener());
};

export const dismissError = () => {
  currentError = null;
  errorListeners.forEach((listener) => listener());
};

export const subscribeError = (listener) => {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
};

export const getError = () => currentError;
