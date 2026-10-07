import { useRef, useEffect, useCallback } from "react";
import { SPEED, easeInOut } from "./propisRuling.js";

// react-hooks/immutability flags loopPlay/runStroke as "used before declared" below — they
// call each other in a genuine cycle (runStroke's base case re-invokes loopPlay to restart
// the loop, which is the looping itself, not an accidental forward reference). Pre-existing
// in the code this hook was extracted from (LoopingLetterCell.jsx had the same unsuppressed
// error before this file existed). A single-line suppression comment placed immediately
// before the call site does not clear it (the rule's reported range spans the whole
// function), so the whole file is disabled for this one rule instead.
/* eslint-disable react-hooks/immutability */

// Drives a looping stroke-by-stroke draw animation over whatever [data-pr-anim="N"] paths
// and [data-pr-tip] circle currently exist inside containerRef.current. Shared by
// LoopingLetterCell (one letter's own strokes) and WordAnimatedCard (a whole word's
// already-assembled stroke list) — the two differ only in how they position/scale their
// own <g>, not in how the draw animation itself runs.
// `evenSpeed`: constant pen speed (every stroke the same units/sec, no ease-in/out per stroke);
// only the very last stroke slows slightly over its final stretch (see evenProgress).
// With evenSpeed there is no pause between strokes either: where the pen leaves the paper (the bar of э, the dots of ё, the strokes
// of Ж) it flies to the next stroke's start through the air, visible but faint, at AIR_SPEED times the writing speed; the only
// slowing down is at the very end of the last stroke (the end of the word / letter).
const AIR_SPEED = 2.5;
const AIR_OPACITY = "0.45";
const EVEN_TAIL_FROM = 0.88; // share of the last stroke after which the pen starts to slow
const EVEN_TAIL_MIN = 0.45;  // relative speed at the very end
function evenProgress(t) {
  const a = EVEN_TAIL_FROM, m = EVEN_TAIL_MIN;
  const total = a + (1 - a) * (1 + m) / 2;
  if (t <= a) return t / total;
  const u = t - a;
  return (a + u - (1 - m) * u * u / (2 * (1 - a))) / total;
}

export function useLoopingStrokes(containerRef, dependencyKey, { delayMs = 0, loopPauseMs = 1400, speedFactor = 1, evenSpeed = false } = {}) {
  const speedRef = useRef(speedFactor);
  speedRef.current = speedFactor; // read per stroke, so "slow" applies without restarting
  const rafRef = useRef(null);
  const timersRef = useRef([]);
  const lensRef = useRef([]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const g = containerRef.current;
    if (!g) return undefined;

    const paths = g.querySelectorAll("[data-pr-anim]");
    lensRef.current = Array.from(paths).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });

    const t = setTimeout(() => loopPlay(g), delayMs);
    timersRef.current.push(t);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey, stop]);

  function loopPlay(g) {
    const paths = g.querySelectorAll("[data-pr-anim]");
    paths.forEach((el, i) => el.setAttribute("stroke-dashoffset", lensRef.current[i]));
    const tip = g.querySelector("[data-pr-tip]");
    if (tip) tip.setAttribute("opacity", "0");

    const PAUSE = 260;
    const strokeCount = paths.length;

    let lastPt = null; // where the pen left the paper (evenSpeed: the air move starts there)
    function runStroke(i) {
      if (i >= strokeCount) {
        if (tip) tip.setAttribute("opacity", "0");
        const t = setTimeout(() => loopPlay(g), loopPauseMs);
        timersRef.current.push(t);
        return;
      }
      // A stroke marked continuous (wordEngine.js: a connector/bridge piece, or the letter
      // stroke it feeds into) is the same unbroken pen motion as the one before it — no
      // pause, unlike a genuine pen-lift between a letter's own separate strokes. The pause
      // (or lack of it) belongs entirely here, gating entry into stroke i — animStroke's
      // onDone goes straight to runStroke(i + 1) so a continuous i + 1 never picks up a
      // second, redundant pause on top of this one.
      const el = g.querySelector(`[data-pr-anim="${i}"]`);
      const lifted = el?.getAttribute("data-pr-continuous") !== "1";
      const done = (pt) => { lastPt = pt; runStroke(i + 1); };
      if (evenSpeed) {
        if (lifted && lastPt && el && tip) airMove(tip, lastPt, el.getPointAtLength(0), () => animStroke(g, i, tip, done));
        else animStroke(g, i, tip, done);
        return;
      }
      const t = setTimeout(() => {
        animStroke(g, i, tip, done);
      }, lifted ? PAUSE : 0);
      timersRef.current.push(t);
    }

    runStroke(0);
  }

  // the pen through the air from `a` to `b` (no ink), faint, at AIR_SPEED times the writing speed
  function airMove(tip, a, b, onDone) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const dur = (dist / (SPEED * AIR_SPEED * (speedRef.current || 1))) * 1000;
    if (dur < 16) { onDone(); return; }
    const t0 = performance.now();
    function frame(now) {
      const k = Math.min((now - t0) / dur, 1);
      tip.setAttribute("transform", `translate(${a.x + (b.x - a.x) * k} ${a.y + (b.y - a.y) * k})`);
      tip.setAttribute("opacity", AIR_OPACITY);
      if (k < 1) rafRef.current = requestAnimationFrame(frame);
      else onDone();
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  function animStroke(g, idx, tip, onDone) {
    const el = g.querySelector(`[data-pr-anim="${idx}"]`);
    if (!el) { onDone(); return; }
    const len = lensRef.current[idx];
    const isLast = idx === lensRef.current.length - 1;
    // the tail slowdown lengthens the last stroke a little, so the base speed stays the same
    const dur = (len / (SPEED * (speedRef.current || 1))) * 1000 * (evenSpeed && isLast ? 1 + (1 - EVEN_TAIL_FROM) * (1 - EVEN_TAIL_MIN) / 2 : 1);
    const t0 = performance.now();

    function frame(now) {
      const raw = Math.min((now - t0) / dur, 1);
      const eased = evenSpeed ? (isLast ? evenProgress(raw) : raw) : easeInOut(raw);
      el.setAttribute("stroke-dashoffset", len * (1 - eased));
      const pt = el.getPointAtLength(eased * len);
      if (tip) {
        // translate, not cx/cy — the tip is a small <g> (pen shaft + contact point), not a
        // bare <circle>, so it needs a transform to reposition all its children at once.
        tip.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
        tip.setAttribute("opacity", "0.9");
      }
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        el.setAttribute("stroke-dashoffset", 0);
        // evenSpeed: the pen stays in sight between strokes (it goes on, or flies to the next one); it disappears at the end only
        if (tip && !evenSpeed) tip.setAttribute("opacity", "0");
        onDone(pt);
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }
}
