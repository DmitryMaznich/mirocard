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
export function readSheet(key, count = 4) {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    return Array.from({ length: count }, (_, i) => {
      const entry = raw?.[i];
      if (!entry?.kind) return null;
      const state = restoreShape({ version: entry.variant ? 3 : 2, attempt: entry }, entry.kind, entry.variant);
      return state.done ? state : null;
    });
  } catch { return Array.from({length:count},()=>null); }
}
export function saveSheet(key, slot, state, count = 4) {
  try {
    const entries = readSheet(key, Math.max(count,slot+1)); entries[slot] = state;
    localStorage.setItem(key, JSON.stringify(entries));
    const keys = Object.keys(localStorage).filter(k => k.startsWith('drawing-sheet:'));
    for (const old of keys.slice(0, Math.max(0, keys.length - 12))) if (old !== key) localStorage.removeItem(old);
  } catch { /* Optional persistence; drawing remains available. */ }
}


export const gridKey = (studentId,sessionId) => `drawing-grid:${studentId??'local'}:${sessionId}`;
export function readGrid(key) {
  try {
    const grid=JSON.parse(localStorage.getItem(key));
    return grid&&Number.isInteger(grid.columns)&&Number.isInteger(grid.rows)&&grid.columns>=2&&grid.rows>=2&&grid.columns<=4&&grid.rows<=4&&grid.columns*grid.rows<=12?grid:null;
  } catch {return null;}
}
export function saveGrid(key,grid) {
  try {
    localStorage.setItem(key,JSON.stringify(grid));
    const keys=Object.keys(localStorage).filter(k=>k.startsWith('drawing-grid:'));
    for(const old of keys.slice(0,Math.max(0,keys.length-45)))if(old!==key)localStorage.removeItem(old);
  } catch { /* The current session still keeps its grid in memory. */ }
}
