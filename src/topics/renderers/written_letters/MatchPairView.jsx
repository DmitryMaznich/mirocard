import { useState, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import HandwrittenLetter from "./HandwrittenLetter";
import { shuffle } from "@/shared/utils/shuffle";

// Propis constants — mirror HandwrittenLetter.jsx
const VBW = 100;
const VBH = 150;
const L2  = 62;
const L3  = 88;
const L4  = 140;

const STIM_SIZE = 120;
const STIM_H    = Math.round(STIM_SIZE * VBH / VBW); // 180px
const L2_PX     = Math.round(L2 / VBH * STIM_H);     // 74px  — top working line
const L3_PX     = Math.round(L3 / VBH * STIM_H);     // 106px — baseline
const PITCH_PX  = Math.round((L4 - L2) / VBH * STIM_H); // 94px — row height

const CHIP_SIZE    = STIM_SIZE;
const CHIP_H       = STIM_H;
const CHIP_L3_PX   = L3_PX;

const CHIP_GAP_PX   = Math.round(2 * PITCH_PX - (STIM_H - L3_PX) - CHIP_L3_PX); //  8px
const ROW_INNER_GAP = Math.round(1 * PITCH_PX - (CHIP_H  - L3_PX) - CHIP_L3_PX); // -86px

const CHIPS_PER_ROW = 3;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default function MatchPairView({ task, onAdvance, onCorrect, onMistake }) {
  const rootRef = useRef(null);
  const stimRef = useRef(null);
  const dropRef = useRef(null);
  const ptrRef  = useRef(null);

  const [dropped,      setDropped]      = useState(null);
  const [flash,        setFlash]        = useState(null);
  const [dragPos,      setDragPos]      = useState(null);
  const [overZone,     setOverZone]     = useState(false);
  const [done,         setDone]         = useState(false);
  const [phase,        setPhase]        = useState("pair");   // "pair" | "confirm"
  const [confirmFlash, setConfirmFlash] = useState(null);     // { letter, state: "correct"|"wrong" }

  // 4 options for the confirm step: correct target + 3 distractors, shuffled once per task
  const confirmOpts = useMemo(() => {
    const target = (task.options ?? []).find((o) => o.isTarget);
    const others = (task.options ?? []).filter((o) => !o.isTarget).slice(0, 3);
    return target ? shuffle([target, ...others]) : [];
  }, [task]);

  // Align horizontal propis lines with the stimulus SVG lines.
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
    const hw = CHIP_SIZE / 2;
    const hh = CHIP_H   / 2;
    return (
      x + hw > r.left  &&
      x - hw < r.right &&
      y + hh > r.top   &&
      y - hh < r.bottom
    );
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
      setDone(true);
      if (task.secondStep) {
        // Instant switch to confirm — no flash, onCorrect deferred to confirm step
        setPhase("confirm");
      } else {
        setFlash("correct");
        onCorrect?.(task.stimulus?.letter, dragPos.opt.letter);
        setTimeout(() => onAdvance?.(), 800);
      }
    } else {
      setFlash("wrong");
      onMistake?.(task.stimulus?.letter, dragPos.opt.letter);
      setTimeout(() => setFlash(null), 600);
    }
  }, [dragPos, task, onCorrect, onMistake, onAdvance]);

  function handleConfirmTap(opt) {
    if (confirmFlash) return;
    if (opt.isTarget) {
      setConfirmFlash({ letter: opt.letter, state: "correct" });
      onCorrect?.(task.stimulus?.letter, dropped?.letter);
      setTimeout(() => onAdvance?.(), 600);
    } else {
      setConfirmFlash({ letter: opt.letter, state: "wrong" });
      setTimeout(() => setConfirmFlash(null), 500);
    }
  }

  const dropCls = [
    "wl-pair-dropzone",
    overZone            ? "wl-pair-dropzone--hover"   : "",
    flash === "correct" ? "wl-pair-dropzone--correct" : "",
    flash === "wrong"   ? "wl-pair-dropzone--wrong"   : "",
  ].filter(Boolean).join(" ");

  const chipRows = chunk(task.options ?? [], CHIPS_PER_ROW);

  return (
    <div
      ref={rootRef}
      className="wl-pair-screen"
      style={{ gap: CHIP_GAP_PX }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {/* Stimulus + drop zone */}
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

      {phase === "pair" ? (
        /* ── Step 1: drag cursive chips ── */
        <div className="wl-pair-chip-section">
          {chipRows.map((row, ri) => (
            <div key={ri} className="wl-pair-chip-row" style={{ position: 'relative', zIndex: chipRows.length - ri, ...(ri > 0 && { marginTop: ROW_INNER_GAP }) }}>
              {row.map((opt, i) => {
                const isFloating = dragPos?.opt === opt;
                return (
                  <div
                    key={(opt.id ?? opt.letter) + ri + i}
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
          ))}
        </div>
      ) : (
        /* ── Step 2: tap the printed letter ── */
        <div className="wl-pair-confirm">
          <div className="wl-pair-confirm__prompt">Какая это буква?</div>
          <div className="wl-pair-confirm__grid">
            {confirmOpts.map((opt, i) => {
              const cls = [
                "wl-pair-confirm__btn",
                confirmFlash?.letter === opt.letter && confirmFlash.state === "correct"
                  ? "wl-pair-confirm__btn--correct" : "",
                confirmFlash?.letter === opt.letter && confirmFlash.state === "wrong"
                  ? "wl-pair-confirm__btn--wrong" : "",
              ].filter(Boolean).join(" ");
              return (
                <button key={opt.letter + i} className={cls} onClick={() => handleConfirmTap(opt)}>
                  {opt.letter}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating letter (pair phase only) */}
      {phase === "pair" && dragPos && (
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
