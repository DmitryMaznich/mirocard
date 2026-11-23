import { useCallback, useEffect, useRef, useState } from "react";
import { mergePlanDocs, normalizePlanDoc, planChangesKey, toggleKey, updatePlanDoc } from "./weekPlan.js";

// «Сделали» marks: only the child makes them, at the wall, so they stay on
// this device (like the weather pick). Dates before oldestKey are dropped.
const DONE_STORAGE_KEY = "daily_orientation_plan_changes";
// The shared changes document, cached for a start without the network.
const SHARED_CACHE_PREFIX = "daily_orientation_plan_shared:";
// A change made on a phone reaches the wall within this time.
const SHARED_POLL_MS = 60_000;

function readJson(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort: blocked storage only means it won't survive a reload.
  }
}

export function useDoneMarks(oldestKey) {
  const [, forceRerender] = useState(0);
  const all = readJson(DONE_STORAGE_KEY) ?? {};
  const doneFor = (dateKey) => all[dateKey]?.done ?? [];
  const toggleDone = useCallback((dateKey, itemKey) => {
    const current = readJson(DONE_STORAGE_KEY) ?? {};
    const next = Object.fromEntries(Object.entries(current).filter(([key]) => key >= oldestKey));
    next[dateKey] = { done: toggleKey(next[dateKey]?.done, itemKey) };
    writeJson(DONE_STORAGE_KEY, next);
    forceRerender((v) => v + 1);
  }, [oldestKey]);
  return { doneFor, toggleDone };
}

// Cancelled/added events per date, shared by every device of the account
// through accountKv (see weekPlan.js «Changes shared between devices»).
// Without accountKv, a signed-out app or no network it keeps working on this
// device and sends its changes through the app's offline queue when it can.
export function useSharedPlanChanges({ accountKv, studentId, oldestKey, pollMs = SHARED_POLL_MS }) {
  const key = studentId ? planChangesKey(studentId) : null;
  const cacheKey = key ? `${SHARED_CACHE_PREFIX}${studentId}` : null;
  const [doc, setDoc] = useState(() => normalizePlanDoc(cacheKey ? readJson(cacheKey) : null));
  const docRef = useRef(doc);

  const keep = useCallback((next) => {
    docRef.current = next;
    setDoc(next);
    if (cacheKey) writeJson(cacheKey, next);
  }, [cacheKey]);

  const refresh = useCallback(async () => {
    if (!key || !accountKv?.list) return;
    try {
      const items = await accountKv.list(key);
      const remote = items.find((item) => item.key === key)?.value ?? null;
      keep(mergePlanDocs(docRef.current, remote, oldestKey));
    } catch {
      // Offline or signed out: keep what we have.
    }
  }, [key, accountKv, oldestKey, keep]);

  useEffect(() => {
    refresh();
    if (!pollMs) return undefined;
    const timer = window.setInterval(refresh, pollMs);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, pollMs]);

  const changesFor = useCallback((dateKey) => doc.days[dateKey] ?? { off: [], added: [] }, [doc]);
  const updateChanges = useCallback((dateKey, update) => {
    const next = mergePlanDocs(updatePlanDoc(docRef.current, dateKey, update), null, oldestKey);
    keep(next);
    if (key && accountKv?.put) {
      Promise.resolve(accountKv.put(key, next)).catch(() => {});
    }
  }, [key, accountKv, oldestKey, keep]);

  return { changesFor, updateChanges, refresh };
}
