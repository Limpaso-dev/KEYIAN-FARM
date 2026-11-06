import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, get } from "./api";

/** GET an endpoint and keep { data, loading, error, reload } in state. */
export const useFetch = (path, params, { enabled = true } = {}) => {
  const [state, setState] = useState({ data: null, loading: Boolean(path && enabled), error: "" });
  const key = JSON.stringify(params || {});
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!path || !enabled) return;
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await get(path, JSON.parse(key));
      if (id === latest.current) setState({ data, loading: false, error: "" });
    } catch (error) {
      if (id === latest.current) setState((s) => ({ ...s, loading: false, error: errorMessage(error) }));
    }
  }, [path, key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
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

export const clearFetchCache = () => cache.clear();
