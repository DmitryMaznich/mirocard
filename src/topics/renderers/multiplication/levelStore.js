// Where the level of a mode lives during a lesson and between lessons.
// The renderer is remounted for every task, so the lesson state is kept per session here.
// «Сам по успехам» (level "auto") remembers the reached level per student and mode on this
// device; a level chosen by the adult stays fixed for the whole lesson.
import { LEVELS, nextLevel } from "./mechanics.js";

const sessions = new Map();
const storageKey = (studentId, modeId) => `mirocard.multiplication.level.${studentId ?? "anon"}.${modeId}`;

function savedLevel(studentId, modeId) {
  try {
    const value = globalThis.localStorage?.getItem(storageKey(studentId, modeId));
    return LEVELS[modeId].includes(value) ? value : null;
  } catch { return null; }
}

export function lessonLevel({ sessionId, modeId, studentId, param }) {
  const key = `${sessionId}:${modeId}`;
  if (!sessions.has(key)) {
    const fixed = param && param !== "auto";
    sessions.set(key, {
      level: fixed ? param : (savedLevel(studentId, modeId) ?? LEVELS[modeId][0]),
      fixed,
      history: [],
      strike: 0,
    });
  }
  return sessions.get(key);
}

// result: { clean, down } — see nextLevel in mechanics.js.
export function recordResult({ sessionId, modeId, studentId }, result) {
  const key = `${sessionId}:${modeId}`;
  const state = sessions.get(key);
  if (!state) return null;
  const next = state.fixed ? { ...state } : nextLevel(modeId, state, result);
  sessions.set(key, next);
  if (!next.fixed) {
    try { globalThis.localStorage?.setItem(storageKey(studentId, modeId), next.level); } catch { /* private mode */ }
  }
  return next;
}

// «Сделай поровну»: the demo hand plays once per lesson (true the first time only).
const demos = new Set();
export const demoPending = ({ sessionId, modeId }) => !demos.has(`${sessionId}:${modeId}`);
export const markDemoPlayed = ({ sessionId, modeId }) => { demos.add(`${sessionId}:${modeId}`); };

export function resetLessonLevels() { sessions.clear(); demos.clear(); }
