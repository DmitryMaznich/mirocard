import { restoreAttempt } from './lineAttempt.js';

export function checkpointKey(studentId, sessionId, taskId) {
  return `drawing-first-lines:${studentId ?? 'local'}:${sessionId}:${taskId}`;
}

export function readCheckpoint(key) {
  try { return restoreAttempt(JSON.parse(localStorage.getItem(key))); } catch { return restoreAttempt(null); }
}

export function saveCheckpoint(key, attempt) {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, attempt }));
    // Keep this experiment's storage bounded, without touching paper-lesson progress.
    const keys = Object.keys(localStorage).filter(value => value.startsWith('drawing-first-lines:'));
    for (const old of keys.slice(0, Math.max(0, keys.length - 45))) if (old !== key) localStorage.removeItem(old);
  } catch { /* Drawing still works when storage is unavailable. */ }
}
