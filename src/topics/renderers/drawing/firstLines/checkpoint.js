import { restoreShape } from './shapeAttempt.js';

export function checkpointKey(studentId, sessionId, taskId) {
  return `drawing-first-lines:${studentId ?? 'local'}:${sessionId}:${taskId}`;
}

export function readCheckpoint(key, kind = 'short_line', variant) {
  try { return restoreShape(JSON.parse(localStorage.getItem(key)), kind, variant); } catch { return restoreShape(null, kind, variant); }
}

export function saveCheckpoint(key, attempt) {
  try {
    localStorage.setItem(key, JSON.stringify({ version: attempt.variant ? 3 : attempt.parts ? 2 : 1, attempt }));
    // Keep this experiment's storage bounded, without touching paper-lesson progress.
    const keys = Object.keys(localStorage).filter(value => value.startsWith('drawing-first-lines:'));
    for (const old of keys.slice(0, Math.max(0, keys.length - 45))) if (old !== key) localStorage.removeItem(old);
  } catch { /* Drawing still works when storage is unavailable. */ }
}

export function sheetKey(studentId, sessionId, page) {
  return `drawing-sheet:${studentId ?? 'local'}:${sessionId}:${page}`;
}
export function readSheet(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    return Array.from({ length: 4 }, (_, i) => {
      const entry = raw?.[i];
      if (!entry?.kind) return null;
      const state = restoreShape({ version: entry.variant ? 3 : 2, attempt: entry }, entry.kind, entry.variant);
      return state.done ? state : null;
    });
  } catch { return [null, null, null, null]; }
}
export function saveSheet(key, slot, state) {
  try {
    const entries = readSheet(key); entries[slot] = state;
    localStorage.setItem(key, JSON.stringify(entries));
    const keys = Object.keys(localStorage).filter(k => k.startsWith('drawing-sheet:'));
    for (const old of keys.slice(0, Math.max(0, keys.length - 12))) if (old !== key) localStorage.removeItem(old);
  } catch { /* Optional persistence; drawing remains available. */ }
}
