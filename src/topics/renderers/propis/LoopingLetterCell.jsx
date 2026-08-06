import { useRef, useEffect, useCallback } from "react";
import { LINE_MM, UNIT_H, L2, L3, LETTER_BASELINE_UNIT, LETTER_XHEIGHT_UNIT_SPAN, INK_COLOR, NIB_COLOR, STROKE_W, TIP_R, SPEED, easeInOut } from "./propisRuling.js";

// One item's animated sample, looping forever until unmounted.
export default function LoopingLetterCell({ item, delayMs = 0, loopPauseMs = 1400 }) {
  const gRef      = useRef(null);
  const rafRef    = useRef(null);
  const timersRef = useRef([]);
  const lens      = useRef([]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return undefined;

    const paths = g.querySelectorAll("[data-pr-anim]");
    lens.current = Array.from(paths).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });

    const t = setTimeout(() => loopPlay(g), delayMs);
    timersRef.current.push(t);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, stop]);

  function loopPlay(g) {
    const paths = g.querySelectorAll("[data-pr-anim]");
    paths.forEach((el, i) => el.setAttribute("stroke-dashoffset", lens.current[i]));
    const tip = g.querySelector("[data-pr-tip]");
    if (tip) tip.setAttribute("opacity", "0");

    const PAUSE = 260;

    function runStroke(i) {
      if (i >= item.strokes.length) {
        if (tip) tip.setAttribute("opacity", "0");
        const t = setTimeout(() => loopPlay(g), loopPauseMs);
        timersRef.current.push(t);
        return;
      }
      const t = setTimeout(() => {
        animStroke(g, i, tip, () => {
          const t2 = setTimeout(() => runStroke(i + 1), PAUSE);
          timersRef.current.push(t2);
        });
      }, PAUSE);
      timersRef.current.push(t);
    }

    runStroke(0);
  }

  function animStroke(g, idx, tip, onDone) {
    const el = g.querySelector(`[data-pr-anim="${idx}"]`);
    if (!el) { onDone(); return; }
    const len = lens.current[idx];
    const dur = (len / SPEED) * 1000;
    const t0  = performance.now();

    function frame(now) {
      const raw   = Math.min((now - t0) / dur, 1);
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

  const [vbMinX, vbMinY] = (item.viewBox || "0 0 100 150").split(" ").map(Number);

  // Scale so the letter's own x-height body (LETTER_XHEIGHT_UNIT_SPAN, its main body
  // excluding ascenders/descenders) matches the ruling's узкая строка exactly — not the
  // letter's whole 150-unit box against the whole row, which underscales the body.
  const rulingNarrowMm = ((L3 - L2) / UNIT_H) * LINE_MM;
  const scale = rulingNarrowMm / LETTER_XHEIGHT_UNIT_SPAN;

  // Re-anchor onto the ruling's actual baseline guide (L3) instead of relying on the
  // letter's baked-in baseline (LETTER_BASELINE_UNIT, from the original font-formation
  // system) to already land there — the two diverge under the current row zones.
  const targetBaselineMm = (L3 / UNIT_H) * LINE_MM;
  const naiveBaselineMm  = LETTER_BASELINE_UNIT * scale;
  const baselineShiftMm  = targetBaselineMm - naiveBaselineMm;

  return (
    <g ref={gRef} transform={`translate(0 ${baselineShiftMm}) scale(${scale}) translate(${-vbMinX} ${-vbMinY})`}>
      {item.strokes.map((s, i) => (
        <path key={`g${i}`} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={STROKE_W}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
      ))}
      {item.strokes.map((s, i) => (
        <path key={`a${i}`} data-pr-anim={i} d={s.d} fill="none" stroke={INK_COLOR}
          strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <circle data-pr-tip r={TIP_R} cx="0" cy="0" fill={NIB_COLOR} opacity="0" />
    </g>
  );
}
