import { useMemo, useState, useEffect, useRef } from "react";
import { layoutTextIntoRows } from "./wordEngine.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";
import { INK_COLOR, NATIVE_L1, NATIVE_L2, NATIVE_L3, NATIVE_L4, UNIT_H } from "./propisRuling.js";

// Same fixed on-screen row height / guide-line / fallback-glyph setup as WriteTextView.jsx
// (kept in sync deliberately, not shared, since the two views' keyboard-vs-no-keyboard
// layouts diverge enough that a shared constants module would need its own upkeep for
// very little payoff -- see that file for the full reasoning behind each constant).
const ROW_HEIGHT_PX = 72;

const GUIDE_ROW_LINES = [
  { y: NATIVE_L1, bold: false },
  { y: NATIVE_L2, bold: false },
  { y: NATIVE_L3, bold: true },
  { y: NATIVE_L4, bold: false },
];
const GUIDE_COLOR = "#6fa3e0";
const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;

const FALLBACK_FONT_SIZE = 34;

// Read-only sibling of WriteTextView.jsx (confirmed with the user 2026-08-19): same
// grid/layoutTextIntoRows/tap-to-animate rendering, but the text comes pre-selected from
// the params screen (task.texts, plural -- one task holds every text the parent picked,
// see engine.js) instead of being typed live, so there's no keyboard at all. The child
// copies the on-screen model into their own paper notebook; this view never captures
// anything they write.
export default function ReadTextView({ task, onClose }) {
  const lettersByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.letters ?? []) map.set(item.label ?? item.id, item);
    return map;
  }, [task]);

  const connectorsByKey = useMemo(() => {
    const map = new Map();
    for (const item of task?.connectors ?? []) {
      const key = `${item.fromLine}_${item.toLine}`;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [task]);

  const texts = task?.texts ?? [];
  // Own internal Prev/Next state, same self-contained pattern PropisPracticeView already
  // uses for letter/case switching -- no other propis mode relies on the session engine's
  // own task-advance machinery, so this doesn't either (see engine.js's own comment).
  const [textIndex, setTextIndex] = useState(0);
  const text = texts[textIndex] ?? "";

  const [activeIndex, setActiveIndex] = useState(null);
  useEffect(() => setActiveIndex(null), [textIndex]);

  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(320);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWrapW(entries[0].contentRect.width || 320);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowWidthUnits = (wrapW / ROW_HEIGHT_PX) * UNIT_H;

  // No cache needed here the way WriteTextView needs one -- that one rebuilds on every
  // keystroke; this view's text only changes when textIndex changes (Prev/Next), so the
  // real stroke-geometry work happens at most once per text, not once per keystroke.
  const layout = useMemo(
    () => layoutTextIntoRows(text, lettersByLabel, connectorsByKey, rowWidthUnits),
    [text, lettersByLabel, connectorsByKey, rowWidthUnits]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "auto" });
  }, [textIndex]);

  const canPrev = textIndex > 0;
  const canNext = textIndex < texts.length - 1;

  return (
    <div className="propis-practice-stage">
      <button type="button" className="propis-ctrl-btn propis-practice-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-text-frame">
        {texts.length === 0 ? (
          <div className="propis-empty-hint">
            Для этого занятия не выбрано ни одного текста.
          </div>
        ) : (
          <>
            <div className="propis-text-grid-scroll" ref={wrapRef}>
              <svg
                className="propis-text-grid-svg"
                viewBox={`0 0 ${rowWidthUnits} ${layout.rowCount * UNIT_H}`}
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
                {Array.from({ length: layout.rowCount }, (_, rowIndex) =>
                  GUIDE_ROW_LINES.map((g, gi) => (
                    <line
                      key={`${rowIndex}_${gi}`}
                      x1="0" y1={rowIndex * UNIT_H + g.y} x2={rowWidthUnits} y2={rowIndex * UNIT_H + g.y}
                      stroke={GUIDE_COLOR}
                      strokeWidth={g.bold ? GUIDE_BOLD_W : GUIDE_THIN_W}
                    />
                  ))
                )}
                {layout.placed.map((p, i) => {
                  const wordWidth = p.segments.reduce((sum, seg) => sum + seg.width, 0);
                  const isActive = i === activeIndex;
                  return (
                    <g key={i} transform={`translate(${p.x} ${p.rowIndex * UNIT_H})`}>
                      <rect
                        className="propis-text-word-hit"
                        x={-4} y={0} width={wordWidth + 8} height={UNIT_H}
                        onClick={() => setActiveIndex((cur) => (cur === i ? null : i))}
                      />
                      {p.segments.map((seg, si) =>
                        seg.type === "cursive" ? (
                          <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                            {isActive ? (
                              <AnimatedStrokes trajectory={seg.trajectory} />
                            ) : (
                              seg.trajectory.strokes.map((s, ssi) => (
                                <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              ))
                            )}
                          </g>
                        ) : (
                          <text
                            key={si}
                            x={seg.xOffset} y={NATIVE_L3}
                            fontSize={FALLBACK_FONT_SIZE}
                            fontFamily="system-ui, sans-serif"
                            fill={INK_COLOR}
                          >
                            {seg.text}
                          </text>
                        )
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="propis-text-nav">
              <button
                type="button"
                className="propis-ctrl-btn"
                onClick={() => setTextIndex((i) => Math.max(0, i - 1))}
                disabled={!canPrev}
                aria-label="Предыдущий текст"
              >
                ‹
              </button>
              <span className="propis-text-nav__counter">Текст {textIndex + 1} из {texts.length}</span>
              <button
                type="button"
                className="propis-ctrl-btn"
                onClick={() => setTextIndex((i) => Math.min(texts.length - 1, i + 1))}
                disabled={!canNext}
                aria-label="Следующий текст"
              >
                ›
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
