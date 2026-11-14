import { resolveProfile } from './trackProfile.js';
import { hasExcessiveWandering } from './straightness.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const copy = p => ({ x: p.x, y: p.y });
export function freshCurve(part) {
  return { progress: 0, anchor: copy(part.points[0]), start: null, startS: 0, strokes: [], marks: [], needsReturn: false, hadError: false, errorKind: null, corner: 0, done: false };
}
export function createCurveAttempt(part, saved, width = 'normal', { stopAtFinish = false } = {}) {
  const state = structuredClone({ ...freshCurve(part), ...saved });
  const profile = resolveProfile(width), halfWidth = profile.width / 2;
  let active, last, lastTime, outside, checkpoint, finishReached=false;
  const nearest = (p, min = 0, max = part.length + 80) => {
    let best = { distance: Infinity, s: 0 };
    for (const target of part.points) {
      if (target.s < min || target.s > max) continue;
      const d = distance(p, target);
      if (d < best.distance) best = { distance: d, s: target.s };
    }
    return best;
  };
  const fail = (p, errorKind, all = false) => {
    finishReached=false;
    const mistake = !state.hadError;
    state.hadError = true; state.needsReturn = true; state.errorKind = errorKind;
    state.marks.push(copy(p));
    if (all) {
      state.progress = 0; state.corner = 0; state.start = null; state.startS = 0; state.anchor = copy(part.points[0]);
      state.strokes.forEach(s => { s.failedFrom = 0; });
    }
    return mistake;
  };
  function begin(p, time = 0) {
    if (active || state.done || distance(p, state.anchor) > profile.resume || nearest(p).distance > (state.needsReturn ? halfWidth : halfWidth + profile.extra)) return false;
    const target = nearest(p, Math.max(0, state.progress - 30), state.progress + 60);
    if (!state.start && target.s > Math.min(36, profile.resume)) return false;
    state.needsReturn = false;
    if (!state.start) { state.start = copy(p); state.startS = target.s; state.progress = target.s; }
    checkpoint = { progress: state.progress, anchor: copy(state.anchor), corner: state.corner };
    active = { points: [copy(p)], failedFrom: null }; state.strokes.push(active);
    last = p; lastTime = time; outside = null; finishReached=stopAtFinish&&atFinish(p); return true;
  }
  function move(p, time = lastTime) {
    if (stopAtFinish && finishReached) return { mistake: false };
    if (!active || state.needsReturn || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return { mistake: false };
    const from = last, fromTime = lastTime, length = distance(from, p), count = Math.max(1, Math.ceil(length / profile.sampleStep));
    let mistake = false;
    for (let i = 1; i <= count; i++) {
      if (state.needsReturn) break;
      const f = i / count, sample = { x: from.x + (p.x - from.x) * f, y: from.y + (p.y - from.y) * f };
      const t = fromTime + Math.max(0, time - fromTime) * f;
      active.points.push(copy(sample));
      if (state.needsReturn) continue;
      const deviation = nearest(sample, 0, part.length).distance;
      const corner = part.waypoints?.[state.corner];
      if (corner && distance(sample, corner) <= profile.corner) state.corner++;
      if (deviation > halfWidth + profile.extra) {
        outside ??= { time: t, length: 0, index: Math.max(0, active.points.length - 2), point: copy(sample) };
        outside.length += length / count;
        if ((t - outside.time >= 80 && outside.length >= profile.outsideMin) || outside.length >= profile.outsideFast) {
          active.failedFrom = outside.index; mistake = fail(outside.point, 'boundary') || mistake;
        }
      } else {
        outside = null;
        const target = nearest(sample, Math.max(0, state.progress - 30), state.progress + 80);
        const pendingCorner = part.waypoints?.[state.corner];
        if (target.distance <= halfWidth + profile.extra && (!pendingCorner || target.s <= pendingCorner.s + profile.corner)) {
          state.progress = Math.max(state.progress, target.s);
          if (deviation <= halfWidth) state.anchor = copy(sample);
        }
      }
      if (stopAtFinish && atFinish(sample)) { finishReached=true; last=sample; lastTime=t; break; }
    }
    if (!finishReached) { last = p; lastTime = time; }
    if (!state.needsReturn && hasExcessiveWandering(state.strokes, state.progress - state.startS, { noise: profile.noise, maxLengthRatio: 1.8, excess: 160 })) {
      state.progress = checkpoint.progress; state.anchor = checkpoint.anchor; state.corner = checkpoint.corner; active.failedFrom = 0;
      mistake = fail(p, 'shape') || mistake;
    }
    return { mistake };
  }
  const atFinish = point => Boolean(active) && Boolean(point) && !state.needsReturn && state.progress - state.startS >= part.length * .94
    && state.corner >= (part.waypoints?.length ?? 0) && distance(point, part.closed ? state.start : part.end) <= (part.closed ? profile.close : profile.finish);
  const ready = () => atFinish(last);
  function end(cancelled = false) {
    if (!active) return false;
    let complete = !cancelled && ready();
    if (complete && part.aspect) {
      const points = state.strokes.flatMap(s => s.points.slice(0, s.failedFrom === null ? undefined : s.failedFrom));
      const bounds = points.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minY: Math.min(b.minY, p.y), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
      const ratio = (bounds.maxX - bounds.minX) / Math.max(1, bounds.maxY - bounds.minY);
      if (ratio < part.aspect[0] || ratio > part.aspect[1]) {
        // The entire contour needs repeating; retain its actual trace as an error.
        fail(last, 'shape', true); complete = false;
      }
    }
    active = null; outside = null; last = null; finishReached=false; state.done = complete; return complete;
  }
  return { state, line: { halfWidth }, begin, move, end, get active() { return Boolean(active); }, get ready() { return ready(); } };
}
