import { createLineAttempt, freshAttempt, restoreAttempt } from './lineAttempt.js';
import { createCurveAttempt, freshCurve } from './curveAttempt.js';
import { shapeDefinition, transformPoint, normalizeVariant, partPoint } from './shapes.js';
import { resolveProfile, scaledProfile } from './trackProfile.js';
export function freshShape(kind, variant) {
  const shape = shapeDefinition(kind, variant);
  return { kind: shape.id, variant: shape.variant, part: 0, parts: shape.parts.map(p => p.type === 'line' ? freshAttempt() : freshCurve(p)), hadError: false, done: false };
}
export function restoreShape(raw, kind, variant) {
  const fresh = freshShape(kind, variant);
  if (raw?.version === 1 && kind === 'short_line') {
    if (JSON.stringify(normalizeVariant(variant)) !== JSON.stringify(normalizeVariant())) return fresh;
    fresh.parts[0] = restoreAttempt(raw); fresh.hadError = fresh.parts[0].hadError; fresh.done = fresh.parts[0].done; return fresh; }
  const s = [2, 3].includes(raw?.version) ? raw.attempt : null;
  if (!s || s.kind !== fresh.kind || !Number.isInteger(s.part) || s.part < 0 || s.part >= fresh.parts.length || s.parts?.length !== fresh.parts.length) return fresh;
  // Checkpoints are local data, but malformed/incompatible geometry must never credit a card.
  const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 10000 && Math.abs(p.y) < 10000;
  if (!s.parts.every(p => Number.isFinite(p.progress) && validPoint(p.anchor) && Array.isArray(p.strokes) && p.strokes.every(stroke => Array.isArray(stroke.points) && stroke.points.every(validPoint) && (stroke.failedFrom === null || (Number.isInteger(stroke.failedFrom) && stroke.failedFrom >= 0 && stroke.failedFrom < stroke.points.length))) && Array.isArray(p.marks) && p.marks.every(validPoint))) return fresh;
  if (s.variant && JSON.stringify(normalizeVariant(s.variant)) !== JSON.stringify(normalizeVariant(variant))) return fresh;
  if (!s.variant && JSON.stringify(normalizeVariant(variant)) !== JSON.stringify(normalizeVariant())) return fresh;
  const shape = shapeDefinition(kind, variant);
  if (!s.parts.every((p, i) => {
    const part = shape.parts[i];
    const inRange = part.type === 'line' ? p.progress >= 320 && p.progress <= 680 : p.progress >= 0 && p.progress <= part.length + 80 && (p.start === null || validPoint(p.start)) && Number.isFinite(p.startS) && p.startS >= 0 && p.startS <= 120;
    return inRange && (i < s.part ? p.done : i > s.part ? !p.done : Boolean(p.done) === Boolean(s.done));
  })) return fresh;
  return { ...structuredClone(s), variant: shape.variant, hadError: Boolean(s.hadError || s.parts.some(p => p.hadError)), done: Boolean(s.done) };
}
export function createShapeAttempt(kind = 'short_line', saved, width, variant) {
  const shape = shapeDefinition(kind, variant ?? saved?.variant), state = saved ?? freshShape(kind, variant);
  const profile = resolveProfile(width); state.profile = profile; state.variant = shape.variant;
  const controllers = shape.parts.map((part, i) => part.type === 'line' ? createLineAttempt(state.parts[i], scaledProfile(profile, part.frame.scale)) : createCurveAttempt(part, state.parts[i], scaledProfile(profile, part.frame.scale)));
  state.parts = controllers.map(c => c.state);
  const current = () => controllers[state.part];
  return {
    state, shape,
    get readyToLift() {
      if (state.done || shape.parts.length === 1) return false;
      const part = shape.parts[state.part], s = current().state, local = scaledProfile(profile, part.frame.scale);
      const end = part.type === 'line' ? { x: 680, y: 500 } : partPoint(part, 1);
      return s.progress >= (part.type === 'line' ? 644 : part.length * .94) && Math.hypot(s.anchor.x - end.x, s.anchor.y - end.y) <= local.finish;
    },
    get line() { return current().line; }, get active() { return current().active; },
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
