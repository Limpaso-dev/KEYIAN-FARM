import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, get } from "./api";

/** Announced whenever something is saved, so figures elsewhere on screen can refresh. */
export const DATA_CHANGED = "keiyian:data-changed";

/**
 * GET an endpoint and keep { data, loading, error, reload } in state.
 * Whenever something is saved (clearFetchCache), what is on screen loads
 * again by itself, keeping its figures in view meanwhile - so totals and
 * summaries show a new record at once, without refreshing the page.
 */
export const useFetch = (path, params, { enabled = true } = {}) => {
  const [state, setState] = useState({ data: null, loading: Boolean(path && enabled), error: "" });
  const key = JSON.stringify(params || {});
  const latest = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!path || !enabled) return;
    const id = ++latest.current;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await get(path, JSON.parse(key));
      if (id === latest.current) setState({ data, loading: false, error: "" });
    } catch (error) {
      // A quiet refresh that fails leaves the figures as they were.
      if (id === latest.current && !quiet) setState((s) => ({ ...s, loading: false, error: errorMessage(error) }));
    }
  }, [path, key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  // After a save, load again - unless the screen already reloaded this itself.
  useEffect(() => {
    if (!path || !enabled) return undefined;
    let timer;
    const onChange = () => {
      const at = latest.current;
      clearTimeout(timer);
      timer = setTimeout(() => latest.current === at && load({ quiet: true }), 0);
    };
    window.addEventListener(DATA_CHANGED, onChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(DATA_CHANGED, onChange);
    };
  }, [load, path, enabled]);

  const reload = useCallback(() => load(), [load]);
  return { ...state, reload };
};

// Small cache for drop-down lists that many forms share.
const cache = new Map();
const TTL = 30000;

export const fetchCached = async (path, params) => {
  const key = `${path}?${JSON.stringify(params || {})}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = get(path, params);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
};

/** Forget the cached lists, without announcing a change (signing in or out). */
export const forgetFetchCache = () => cache.clear();

/** After a save: forget the cached lists and let what is on screen refresh. */
export const clearFetchCache = () => {
  forgetFetchCache();
  window.dispatchEvent(new Event(DATA_CHANGED));
};
