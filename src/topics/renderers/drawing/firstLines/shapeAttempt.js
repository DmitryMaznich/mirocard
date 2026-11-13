import { createLineAttempt, freshAttempt, restoreAttempt } from './lineAttempt.js';
import { createCurveAttempt, freshCurve } from './curveAttempt.js';
import { shapeDefinition, transformPoint, normalizeVariant, partPoint } from './shapes.js';
import { resolveProfile, scaledProfile } from './trackProfile.js';
export function freshShape(kind, variant) {
  const shape = shapeDefinition(kind, variant);
  return { kind: shape.id, variant: shape.variant, failures: 0, recovery: null, part: 0, parts: shape.parts.map(p => p.type === 'line' ? freshAttempt() : freshCurve(p)), hadError: false, done: false };
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
  const strokesValid = strokes => Array.isArray(strokes) && strokes.every(stroke => Array.isArray(stroke.points) && stroke.points.every(validPoint)
    && (stroke.failedFrom === null || (Number.isInteger(stroke.failedFrom) && stroke.failedFrom >= 0 && stroke.failedFrom < stroke.points.length)));
  if (!s.parts.every(p => Number.isFinite(p.progress) && validPoint(p.anchor) && strokesValid(p.strokes) && Array.isArray(p.marks) && p.marks.every(validPoint)
    && (p.history === undefined || Array.isArray(p.history) && p.history.every(h => strokesValid(h.strokes) && Array.isArray(h.marks) && h.marks.every(validPoint))))) return fresh;

  if (s.variant && JSON.stringify(normalizeVariant(s.variant)) !== JSON.stringify(normalizeVariant(variant))) return fresh;
  if (!s.variant && JSON.stringify(normalizeVariant(variant)) !== JSON.stringify(normalizeVariant())) return fresh;
  const shape = shapeDefinition(kind, variant);
  if (!s.parts.every((p, i) => {
    const part = shape.parts[i];
    const inRange = part.type === 'line' ? p.progress >= 320 && p.progress <= 680 : p.progress >= 0 && p.progress <= part.length + 80 && (p.start === null || validPoint(p.start)) && Number.isFinite(p.startS) && p.startS >= 0 && p.startS <= 120;
    return inRange && (i < s.part ? p.done : i > s.part ? !p.done : Boolean(p.done) === Boolean(s.done));
  })) return fresh;
  return { ...fresh, ...structuredClone(s), failures: Number.isSafeInteger(s.failures) && s.failures >= 0 ? s.failures : 0, variant: shape.variant, hadError: Boolean(s.hadError || s.parts.some(p => p.hadError)), done: Boolean(s.done) };
}
export function createShapeAttempt(kind = 'short_line', saved, width, variant) {
  const shape = shapeDefinition(kind, variant ?? saved?.variant), state = saved ?? freshShape(kind, variant);
  const profile = resolveProfile(width); state.profile = profile; state.variant = shape.variant;
  const makeController = (part, savedPart) => part.type === 'line' ? createLineAttempt(savedPart, scaledProfile(profile, part.frame.scale)) : createCurveAttempt(part, savedPart, scaledProfile(profile, part.frame.scale));
  const controllers = shape.parts.map((part, i) => makeController(part, state.parts[i]));
  state.parts = controllers.map(c => c.state);
  const current = () => controllers[state.part];
  function restartPart(reason = 'sample') {
    if (state.done) return;
    const old = current().state, part = shape.parts[state.part];
    current().end(true);
    const history = [...(old.history ?? [])];
    if (old.strokes.length) history.push({ strokes: old.strokes, marks: old.marks, reason });
    const next = { ...(part.type === 'line' ? freshAttempt() : freshCurve(part)), hadError: old.hadError, history };
    controllers[state.part] = makeController(part, next); state.parts[state.part] = controllers[state.part].state;
    state.recovery = reason;
    if (reason === 'error') state.failures = (state.failures ?? 0) + 1;
  }
  // A captured pointer cannot survive reload. Recover the failed part before accepting new ink.
  if (current().state.needsReturn) restartPart('error');
  return {
    state, shape, restartPart,
    get readyToLift() { return !state.done && current().ready; },
    get line() { return current().line; }, get active() { return current().active; },
    begin(p, time) {
      if (state.done) return false;
      const part = shape.parts[state.part], local = transformPoint(p, part.frame, true);
      let accepted = current().begin(local, time);
      // Repeating the sample from its start is always a valid way to restart this unfinished part.
      if (!accepted && !current().active && current().state.strokes.length) {
        const start = partPoint(part, 0), radius = scaledProfile(profile, part.frame.scale).resume;
        if (Math.hypot(local.x - start.x, local.y - start.y) <= radius) { restartPart('repeat'); accepted = current().begin(local, time); }
      }
      if (accepted) state.recovery = null;
      return accepted;
    },
    move(p, time) {
      current().move(transformPoint(p, shape.parts[state.part].frame, true), time);
      const mistake = !state.hadError && current().state.hadError;
      if (mistake) state.hadError = true;
      return { mistake, failed: current().state.needsReturn };
    },
    end(cancelled = false) {
      if (state.done) return false;
      const done = current().end(cancelled);
      // Curves can discover a shape error when lifted; the renderer reconciles it too.
      if (current().state.hadError) state.hadError = true;
      if (current().state.needsReturn) { restartPart('error'); return false; }
      if (done) { if (state.part === controllers.length - 1) state.done = true; else state.part++; }
      return state.done;
    },
  };
}
