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
export function useLoopingStrokes(containerRef, dependencyKey, { delayMs = 0, loopPauseMs = 1400 } = {}) {
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
      const pause = el?.getAttribute("data-pr-continuous") === "1" ? 0 : PAUSE;
      const t = setTimeout(() => {
        animStroke(g, i, tip, () => runStroke(i + 1));
      }, pause);
      timersRef.current.push(t);
    }

    runStroke(0);
  }

  function animStroke(g, idx, tip, onDone) {
    const el = g.querySelector(`[data-pr-anim="${idx}"]`);
    if (!el) { onDone(); return; }
    const len = lensRef.current[idx];
    const dur = (len / SPEED) * 1000;
    const t0 = performance.now();

    function frame(now) {
      const raw = Math.min((now - t0) / dur, 1);
      const eased = easeInOut(raw);
      el.setAttribute("stroke-dashoffset", len * (1 - eased));
      const pt = el.getPointAtLength(eased * len);
      if (tip) {
        tip.setAttribute("cx", pt.x);
        tip.setAttribute("cy", pt.y);
        tip.setAttribute("opacity", "0.9");
      }
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        el.setAttribute("stroke-dashoffset", 0);
        if (tip) tip.setAttribute("opacity", "0");
        onDone();
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }
}
