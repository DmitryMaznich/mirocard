import { useCallback, useState } from "react";

const CHANGES_STORAGE_KEY = "daily_orientation_plan_changes";

function readAllChanges() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHANGES_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Per-date changes on this device (like the weather pick): «сделали» marks
// and the adult's cancellations/additions made at the screen. Dates before
// yesterday are dropped on every write.
export function usePlanChanges(oldestKey) {
  const [, forceRerender] = useState(0);
  const all = readAllChanges();
  const changesFor = useCallback((dateKey) => all[dateKey] ?? {}, [all]);
  const updateChanges = useCallback((dateKey, update) => {
    const current = readAllChanges();
    const next = Object.fromEntries(Object.entries(current).filter(([key]) => key >= oldestKey));
    next[dateKey] = update(next[dateKey] ?? {});
    try {
      window.localStorage.setItem(CHANGES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best effort: blocked storage only means the mark won't survive a reload.
    }
    forceRerender((v) => v + 1);
  }, [oldestKey]);
  return { changesFor, updateChanges };
}

