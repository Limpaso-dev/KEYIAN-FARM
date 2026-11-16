import { useCallback, useEffect, useRef, useState } from "react";
import { get, post } from "./api";
import { DATA_CHANGED } from "./useFetch";

/** Fired when a count may have changed without a save (a list was looked at). */
export const COUNTS_CHANGED = "keiyian:counts-changed";
export const refreshNavCounts = () => window.dispatchEvent(new Event(COUNTS_CHANGED));

/**
 * Counts shown beside sidebar entries. A section names its count with
 * `count` (navigation.js). Each is loaded only for users it applies to,
 * every minute, whenever something is saved and when a list is looked at.
 * `word` is what the number counts, read out with it ("2 new").
 */
const SOURCES = {
  // Milk Livestock has sent that MVA has not received yet.
  milkFromLivestock: {
    word: "waiting",
    when: (auth) => auth.can("milkTransfers", "receive"),
    load: async () => (await get("/livestock/milk-transfers", { status: "sent" })).length,
  },
  // Requisitions of the user's department approved, returned or rejected since they last looked.
  requisitionAnswers: {
    word: "new",
    when: (auth) => Boolean(auth.permissions?.requisitions?.raise),
    load: async () => (await get("/requisitions/answers")).count,
  },
  // Requests of the user's department that Stores dispatched or declined since they last looked.
  storeRequestAnswers: {
    word: "new",
    when: (auth) => Boolean(auth.permissions?.storeRequests?.raise),
    load: async () => (await get("/store-requests/answers")).count,
  },
  // Purchase orders whose goods Stores is still expecting.
  expectedDeliveries: {
    word: "waiting",
    when: (auth) => auth.can("storeReceipts", "write"),
    load: async () => (await get("/stores/deliveries", { status: "waiting" })).length,
  },
  // Deliveries Stores recorded against purchase orders since the Accounts officer last looked.
  deliveryAnswers: {
    word: "new",
    when: (auth) => auth.user?.department === "accounts" && auth.can("purchaseOrders"),
    load: async () => (await get("/accounts/purchase-orders/deliveries")).count,
  },
};

/** What a count beside these sections counts: "new", "waiting", or "to see" when they differ. */
export const countWord = (keys) => {
  const words = [...new Set(keys.filter(Boolean).map((key) => SOURCES[key]?.word).filter(Boolean))];
  return words.length === 1 ? words[0] : "to see";
};

export const useNavCounts = (auth) => {
  const [counts, setCounts] = useState({});
  const ready = Boolean(auth.user && !auth.user.mustChangePassword);
  const active = ready ? Object.keys(SOURCES).filter((key) => SOURCES[key].when(auth)).join(",") : "";

  const refresh = useCallback(async () => {
    const keys = active ? active.split(",") : [];
    const values = await Promise.all(keys.map((key) => SOURCES[key].load().catch(() => null)));
    setCounts(Object.fromEntries(keys.map((key, index) => [key, values[index]]).filter(([, value]) => value != null)));
  }, [active]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 60000);
    window.addEventListener(DATA_CHANGED, refresh);
    window.addEventListener(COUNTS_CHANGED, refresh);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener(DATA_CHANGED, refresh);
      window.removeEventListener(COUNTS_CHANGED, refresh);
    };
  }, [refresh]);

  return counts;
};

/**
 * Opening a list of answers (path: "/requisitions" or "/store-requests"; or
 * the address that marks them seen, ending in /seen, such as
 * "/accounts/purchase-orders/deliveries/seen") marks them seen, which clears
 * the count in the sidebar. Returns what had been answered since the user
 * last looked - { since (null: never), count, rows } - so the list can show
 * it and mark those rows new; null until known.
 */
export const useAnswersSeen = (path, enabled) => {
  const [answers, setAnswers] = useState(null);
  // Once per visit, also when React mounts the page twice while developing.
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    // If it fails, nothing is marked new and the count stays for next time.
    post(path.endsWith("/seen") ? path : `${path}/answers/seen`)
      .then((result) => setAnswers(result?.data || null))
      .catch(() => {})
      .finally(refreshNavCounts);
  }, [path, enabled]);
  return answers;
};

/** Whether a row was answered (at: when) since the user last looked; answers from useAnswersSeen. */
export const answeredSince = (answers, at) => Boolean(answers && at && (answers.since === null || new Date(at) > new Date(answers.since)));
