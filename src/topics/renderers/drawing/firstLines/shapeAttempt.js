import { createLineAttempt, freshAttempt, restoreAttempt } from './lineAttempt.js';
import { createCurveAttempt, freshCurve } from './curveAttempt.js';
import { shapeDefinition, transformPoint } from './shapes.js';
export function freshShape(kind) {
  const shape = shapeDefinition(kind);
  return { kind: shape.id, part: 0, parts: shape.parts.map(p => p.type === 'line' ? freshAttempt() : freshCurve(p)), hadError: false, done: false };
}
export function restoreShape(raw, kind) {
  const fresh = freshShape(kind);
  if (raw?.version === 1 && kind === 'short_line') { fresh.parts[0] = restoreAttempt(raw); fresh.hadError = fresh.parts[0].hadError; fresh.done = fresh.parts[0].done; return fresh; }
  const s = raw?.version === 2 ? raw.attempt : null;
  if (!s || s.kind !== fresh.kind || !Number.isInteger(s.part) || s.part < 0 || s.part >= fresh.parts.length || s.parts?.length !== fresh.parts.length) return fresh;
  // Checkpoints are local data, but malformed/incompatible geometry must never credit a card.
  const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 10000 && Math.abs(p.y) < 10000;
  if (!s.parts.every(p => Number.isFinite(p.progress) && validPoint(p.anchor) && Array.isArray(p.strokes) && p.strokes.every(stroke => Array.isArray(stroke.points) && stroke.points.every(validPoint) && (stroke.failedFrom === null || (Number.isInteger(stroke.failedFrom) && stroke.failedFrom >= 0 && stroke.failedFrom < stroke.points.length))) && Array.isArray(p.marks) && p.marks.every(validPoint))) return fresh;
  const shape = shapeDefinition(kind);
  if (!s.parts.every((p, i) => {
    const part = shape.parts[i];
    const inRange = part.type === 'line' ? p.progress >= 320 && p.progress <= 680 : p.progress >= 0 && p.progress <= part.length + 80 && (p.start === null || validPoint(p.start)) && Number.isFinite(p.startS) && p.startS >= 0 && p.startS <= 60;
    return inRange && (i < s.part ? p.done : i > s.part ? !p.done : Boolean(p.done) === Boolean(s.done));
  })) return fresh;
  return { ...structuredClone(s), hadError: Boolean(s.hadError || s.parts.some(p => p.hadError)), done: Boolean(s.done) };
}
export function createShapeAttempt(kind = 'short_line', saved, width) {
  const shape = shapeDefinition(kind), state = saved ?? freshShape(kind);
  const controllers = shape.parts.map((part, i) => part.type === 'line' ? createLineAttempt(state.parts[i], width) : createCurveAttempt(part, state.parts[i], width, shape.id));
  state.parts = controllers.map(c => c.state);
  const current = () => controllers[state.part];
  return {
    state, shape, get line() { return current().line; }, get active() { return current().active; },
    begin(p, time) { return !state.done && current().begin(transformPoint(p, shape.parts[state.part].frame, true), time); },
    move(p, time) {
      current().move(transformPoint(p, shape.parts[state.part].frame, true), time);
      const mistake = !state.hadError && current().state.hadError;
      if (mistake) state.hadError = true;
      return { mistake };
    },
    end(cancelled = false) {
      if (state.done) return false;
      const done = current().end(cancelled);
      // Curves can discover a shape error when lifted; the renderer reconciles it too.
      if (current().state.hadError) state.hadError = true;
      if (done) { if (state.part === controllers.length - 1) state.done = true; else state.part++; }
      return state.done;
    },
  };
}
