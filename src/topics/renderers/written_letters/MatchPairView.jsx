import { useState, useRef, useCallback, useLayoutEffect } from "react";
import HandwrittenLetter from "./HandwrittenLetter";

// Propis constants — must match HandwrittenLetter.jsx
const VBW = 100;
const VBH = 150;
const L2  = 62;
const L3  = 88;
const L4  = 140;

const STIM_SIZE  = 120;                               // SVG width in px
const STIM_H     = Math.round(STIM_SIZE * VBH / VBW); // 180px rendered height
const L2_PX      = Math.round(L2 / VBH * STIM_H);    // 74px from SVG top
const L3_PX      = Math.round(L3 / VBH * STIM_H);    // 106px
const PITCH_PX   = Math.round((L4 - L2) / VBH * STIM_H); // 94px per row

const CHIP_SIZE  = 68;

export default function MatchPairView({ task, onAdvance, onCorrect, onMistake }) {
  const rootRef    = useRef(null);
  const stimRef    = useRef(null);
  const dropRef    = useRef(null);
  const ptrRef     = useRef(null);

  const [dropped,  setDropped]  = useState(null);  // option obj
  const [flash,    setFlash]    = useState(null);   // "correct" | "wrong"
  const [dragPos,  setDragPos]  = useState(null);   // { x, y, opt }
  const [overZone, setOverZone] = useState(false);
  const [done,     setDone]     = useState(false);

  // Align background прописи lines to match the stimulus SVG lines
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
      root.style.backgroundSize     = `100% ${PITCH_PX}px, 100% ${PITCH_PX}px`;
      root.style.backgroundPosition = `0 ${l2Phase}px, 0 ${l3Phase}px`;
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
    overZone          ? "wl-pair-dropzone--hover"   : "",
    flash === "correct" ? "wl-pair-dropzone--correct" : "",
    flash === "wrong"   ? "wl-pair-dropzone--wrong"   : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className="wl-pair-screen"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {/* Stimulus + drop zone — share baseline */}
      <div className="wl-pair-row">
        <div ref={stimRef} className="wl-pair-stimulus">
          <HandwrittenLetter letter={task.stimulus.letter} size={STIM_SIZE} />
        </div>

        <div
          ref={dropRef}
          className={dropCls}
          style={{ width: STIM_SIZE, height: STIM_H }}
        >
          {dropped
            ? <HandwrittenLetter letter={dropped.letter} size={STIM_SIZE} />
            : <span className="wl-pair-dropzone__hint">?</span>
          }
        </div>
      </div>

      {/* Draggable chips */}
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

      {/* Floating chip while dragging */}
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
