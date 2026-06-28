import { useState, useRef, useCallback, useLayoutEffect } from "react";
import HandwrittenLetter from "./HandwrittenLetter";

// Propis constants — mirror HandwrittenLetter.jsx
const VBW = 100;
const VBH = 150;
const L2  = 62;
const L3  = 88;
const L4  = 140;

const STIM_SIZE  = 120;                                    // SVG width px
const STIM_H     = Math.round(STIM_SIZE * VBH / VBW);     // 180px
const L2_PX      = Math.round(L2 / VBH * STIM_H);         // 74px  (top working line in SVG)
const L3_PX      = Math.round(L3 / VBH * STIM_H);         // 106px (baseline in SVG)
const PITCH_PX   = Math.round((L4 - L2) / VBH * STIM_H); // 94px  (row height on screen)

const CHIP_SIZE  = 64;
const CHIP_H     = Math.round(CHIP_SIZE * VBH / VBW);     // 96px
const CHIP_L3_PX = Math.round(L3 / VBH * CHIP_H);         // 56px

// Gap between stimulus row bottom and chip row top so that
// chip baselines fall exactly 3 propis rows below stimulus baseline.
const CHIP_GAP_PX = Math.round(3 * PITCH_PX - (STIM_H - L3_PX) - CHIP_L3_PX);
// = 3×94 − (180−106) − 56 = 282 − 74 − 56 = 152

export default function MatchPairView({ task, onAdvance, onCorrect, onMistake }) {
  const rootRef = useRef(null);
  const stimRef = useRef(null);
  const dropRef = useRef(null);
  const ptrRef  = useRef(null);

  const [dropped,  setDropped]  = useState(null);
  const [flash,    setFlash]    = useState(null);
  const [dragPos,  setDragPos]  = useState(null);
  const [overZone, setOverZone] = useState(false);
  const [done,     setDone]     = useState(false);

  // Align horizontal propis lines with the stimulus SVG lines.
  // Diagonal layer (layer 0) uses auto sizing — no position needed.
  useLayoutEffect(() => {
    const align = () => {
      const root = rootRef.current;
      const stim = stimRef.current;
      if (!root || !stim) return;
      const rr = root.getBoundingClientRect();
      const sr = stim.getBoundingClientRect();
      const svgTopY = sr.top - rr.top;
      const l2Y = svgTopY + L2_PX;
      const l3Y = svgTopY + L3_PX;
      const l2Phase = ((l2Y % PITCH_PX) + PITCH_PX) % PITCH_PX;
      const l3Phase = ((l3Y % PITCH_PX) + PITCH_PX) % PITCH_PX;
      // 3 layers: diagonal (auto), L2 guide, L3 baseline
      root.style.backgroundSize     = `auto, 100% ${PITCH_PX}px, 100% ${PITCH_PX}px`;
      root.style.backgroundPosition = `0 0, 0 ${l2Phase}px, 0 ${l3Phase}px`;
    };
    align();
    window.addEventListener("resize", align);
    return () => window.removeEventListener("resize", align);
  }, [task]);

  function isOverDropZone(x, y) {
    const dz = dropRef.current;
    if (!dz) return false;
    const r = dz.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  const handlePointerDown = useCallback((e, opt) => {
    if (done) return;
    e.preventDefault();
    try { rootRef.current?.setPointerCapture(e.pointerId); } catch { /**/ }
    ptrRef.current = e.pointerId;
    setDragPos({ x: e.clientX, y: e.clientY, opt });
  }, [done]);

  const handlePointerMove = useCallback((e) => {
    if (!dragPos || e.pointerId !== ptrRef.current) return;
    setDragPos((d) => ({ ...d, x: e.clientX, y: e.clientY }));
    setOverZone(isOverDropZone(e.clientX, e.clientY));
  }, [dragPos]);

  const handlePointerEnd = useCallback((e) => {
    if (!dragPos || e.pointerId !== ptrRef.current) return;
    const onTarget = isOverDropZone(e.clientX, e.clientY);
    setDragPos(null);
    setOverZone(false);
    ptrRef.current = null;
    if (!onTarget) return;
    if (dragPos.opt.isTarget) {
      setDropped(dragPos.opt);
      setFlash("correct");
      setDone(true);
      onCorrect?.(task.stimulus?.letter, dragPos.opt.letter);
      setTimeout(() => onAdvance?.(), 800);
    } else {
      setFlash("wrong");
      onMistake?.(task.stimulus?.letter, dragPos.opt.letter);
      setTimeout(() => setFlash(null), 600);
    }
  }, [dragPos, task, onCorrect, onMistake, onAdvance]);

  const dropCls = [
    "wl-pair-dropzone",
    overZone            ? "wl-pair-dropzone--hover"   : "",
    flash === "correct" ? "wl-pair-dropzone--correct" : "",
    flash === "wrong"   ? "wl-pair-dropzone--wrong"   : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className="wl-pair-screen"
      style={{ gap: CHIP_GAP_PX }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {/* Stimulus + drop zone on the same propis baseline */}
      <div className="wl-pair-row">
        <div ref={stimRef}>
          <HandwrittenLetter letter={task.stimulus.letter} size={STIM_SIZE} bare />
        </div>

        <div ref={dropRef} className={dropCls} style={{ width: STIM_SIZE, height: STIM_H }}>
          {dropped
            ? <HandwrittenLetter letter={dropped.letter} size={STIM_SIZE} bare />
            : <span className="wl-pair-dropzone__hint">?</span>
          }
        </div>
      </div>

      {/* Bare chips — directly on the propis lines, no card */}
      <div className="wl-pair-chips">
        {(task.options ?? []).map((opt, i) => {
          const isFloating = dragPos?.opt === opt;
          return (
            <div
              key={(opt.id ?? opt.letter) + i}
              className={[
                "wl-pair-chip",
                isFloating ? "wl-pair-chip--ghost" : "",
                done && !isFloating ? "wl-pair-chip--done" : "",
              ].filter(Boolean).join(" ")}
              onPointerDown={(e) => handlePointerDown(e, opt)}
            >
              <HandwrittenLetter letter={opt.letter} size={CHIP_SIZE} bare />
            </div>
          );
        })}
      </div>

      {/* Floating letter while dragging */}
      {dragPos && (
        <div
          className="wl-pair-chip wl-pair-chip--floating"
          style={{ left: dragPos.x, top: dragPos.y }}
          aria-hidden
        >
          <HandwrittenLetter letter={dragPos.opt.letter} size={CHIP_SIZE} bare />
        </div>
      )}
    </div>
  );
}
