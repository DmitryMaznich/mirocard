// Prototype A1. Coordinates and tolerances are hypotheses in docs/drawing-first-lines.md.
// No rewards here: the renderer reports one mistake and one completion per card.
import { hasExcessiveWandering } from './straightness.js';
export const LINE = Object.freeze({ start: 320, end: 680, y: 500, halfWidth: 50, tolerance: 65, resume: 60 });
export const TRACK_WIDTHS = Object.freeze({ wide: 140, normal: 100, narrow: 60 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const offTrack = p => Math.hypot(p.x - Math.max(LINE.start, Math.min(LINE.end, p.x)), p.y - LINE.y);
const copyPoint = p => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });

export function freshAttempt() {
  return { progress: LINE.start, anchor: { x: LINE.start, y: LINE.y }, strokes: [], marks: [], needsReturn: false, hadError: false, errorKind: null, done: false };
}

// Only our own bounded, versioned checkpoint is restored. A captured pointer is never restored.
export function restoreAttempt(raw) {
  const s = raw?.version === 1 ? raw.attempt : null;
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 10000 && Math.abs(p.y) < 10000;
  if (!s || !Number.isFinite(s.progress) || s.progress < LINE.start || s.progress > LINE.end || !point(s.anchor)
    || !Array.isArray(s.strokes) || !s.strokes.every(stroke => Array.isArray(stroke.points) && stroke.points.every(point)
      && (stroke.failedFrom === null || (Number.isInteger(stroke.failedFrom) && stroke.failedFrom >= 0 && stroke.failedFrom < stroke.points.length)))
    || !Array.isArray(s.marks) || !s.marks.every(point)) return freshAttempt();
  return { ...freshAttempt(), ...s, needsReturn: Boolean(s.needsReturn), hadError: Boolean(s.hadError), done: Boolean(s.done) };
}

export function createLineAttempt(saved = freshAttempt(), trackWidth = 'normal') {
  const halfWidth = (Object.hasOwn(TRACK_WIDTHS, trackWidth) ? TRACK_WIDTHS[trackWidth] : TRACK_WIDTHS.normal) / 2;
  const line = Object.freeze({ ...LINE, halfWidth, tolerance: halfWidth + 15 });
  const state = structuredClone(saved);
  let active = null;
  let outside = null;
  let last = null;
  let lastTime = 0;
  let strokeStart = null;
  const startPoint = () => state.anchor;

  function begin(p, time = 0) {
    const resumeTolerance = state.needsReturn ? line.halfWidth : line.tolerance;
    if (state.done || active || offTrack(p) > resumeTolerance || distance(p, startPoint()) > LINE.resume) return false;
    // Up to 10% starting slack, never a shortcut to the end of the track.
    if (state.progress === LINE.start && p.x > LINE.start + 36) return false;
    state.needsReturn = false;
    strokeStart = { progress: state.progress, anchor: { ...state.anchor } };
    active = { points: [copyPoint(p)], failedFrom: null };
    state.strokes.push(active);
    last = p; lastTime = time; outside = null;
    return true;
  }

  function move(p, time = lastTime) {
    if (!active || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return { mistake: false };
    const from = last, fromTime = lastTime;
    const length = distance(from, p);
    let mistake = false;
    // Subdivide actual segments: identical movement behaves the same at different event rates.
    const count = Math.max(1, Math.ceil(length / 3));
    for (let i = 1; i <= count; i++) {
      const f = i / count;
      const sample = { x: from.x + (p.x - from.x) * f, y: from.y + (p.y - from.y) * f };
      const t = fromTime + Math.max(0, time - fromTime) * f;
      if (distance(active.points.at(-1), sample) >= 3 || i === count) active.points.push(copyPoint(sample));
      if (state.needsReturn) continue;
      const deviation = offTrack(sample);
      if (deviation > line.tolerance) {
        outside ??= { time: t, length: 0, index: Math.max(0, active.points.length - 2), point: copyPoint(sample) };
        outside.length += length / count;
        if ((t - outside.time >= 80 && outside.length >= 12) || outside.length >= 30) {
          state.needsReturn = true;
          active.failedFrom = outside.index;
          state.marks.push(outside.point);
          mistake = !state.hadError;
          state.hadError = true;
          state.errorKind = 'boundary';
        }
      } else {
        outside = null;
        if (sample.x >= state.progress - 30 && sample.x <= state.progress + 80) {
          state.progress = Math.max(state.progress, Math.min(LINE.end, sample.x));
          if (deviation <= line.halfWidth) state.anchor = copyPoint(sample);
        }
      }
    }
    last = p; lastTime = time;
    if (!state.needsReturn && hasExcessiveWandering(state.strokes, state.progress - LINE.start)) {
      // Repeat this movement from its beginning; earlier accepted strokes stay.
      // The failed trace stays visible, but cannot satisfy the completion check.
      state.progress = strokeStart.progress;
      state.anchor = strokeStart.anchor;
      active.failedFrom = 0;
      state.needsReturn = true;
      state.errorKind = 'shape';
      state.marks.push(copyPoint(p));
      mistake = !state.hadError;
      state.hadError = true;
    }
    return { mistake };
  }

  function end(cancelled = false) {
    if (!active) return false;
    const complete = !cancelled && !state.needsReturn && state.progress >= LINE.start + .9 * (LINE.end - LINE.start)
      && distance(last, { x: LINE.end, y: LINE.y }) <= 60;
    active = null; outside = null; last = null;
    state.done = complete;
    return complete;
  }

  return { state, line, begin, move, end, get active() { return Boolean(active); } };
}
