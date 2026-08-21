import { useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { layoutTextIntoRows } from "./wordEngine.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";
import {
  INK_COLOR, NATIVE_L3, UNIT_H, TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET, TEXT_ROW_DIAGONAL_SPACING,
  buildDiagonalLines,
} from "./propisRuling.js";

// Same fixed on-screen row height / guide-line / fallback-glyph setup as WriteTextView.jsx
// (kept in sync deliberately, not shared, since the two views' keyboard-vs-no-keyboard
// layouts diverge enough that a shared constants module would need its own upkeep for
// very little payoff -- see that file for the full reasoning behind each constant).
const ROW_HEIGHT_PX = 72;
// On tablet this view's text renders ~2x larger (2026-08-20 user request, read_text only --
// WriteTextView's keyboard eats most of a tablet's extra width anyway, so it wasn't asked
// for there). rowWidthUnits (below) is inversely proportional to ROW_HEIGHT_PX, so doubling
// it HALVES how many native units span the same real container width -- i.e. every letter
// occupies twice the screen space. Same tablet-breakpoint idiom column_addition's
// useTapButtonSize.js already uses (matchMedia "(min-width: 768px)", live-updating).
const TABLET_ROW_HEIGHT_PX = ROW_HEIGHT_PX * 2;

// Real "косая линейка" cycle -- one thin line (x-height top) and one thick baseline line
// per TEXT_ROW_PITCH, same fix applied here as WriteTextView.jsx (see propisRuling.js's
// TEXT_ROW_PITCH comment for the full derivation of why this replaced the old 4-line
// NATIVE_L1..L4 set, which only fit a single isolated row, not tiled text) -- this view
// inherited the exact same bug from that file, since it reused the same rendering code.
const GUIDE_ROW_LINES = [
  { y: NATIVE_L3 - TEXT_ROW_THIN_OFFSET, bold: false },
  { y: NATIVE_L3, bold: true },
];
const GUIDE_COLOR = "#6fa3e0";
const GUIDE_DIAG_W = 0.25;
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

  const punctuationByLabel = useMemo(() => {
    const map = new Map();
    for (const item of task?.punctuation ?? []) map.set(item.label ?? item.id, item);
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
  // useLayoutEffect (not useEffect) + a synchronous first measurement, deliberately: on every
  // (re)mount -- e.g. each session (re)start, since SessionScreen gives the renderer a fresh
  // key per attempt -- wrapW otherwise starts at the 320 fallback below and only learns the
  // real container width once ResizeObserver's async callback fires a frame later. On tablet
  // that briefly renders at the WRONG (over-stretched, even bigger than the intended 2x) size
  // before snapping to correct -- a visible flash. useLayoutEffect runs before the browser
  // paints, so measuring here means the first paint already has the right width.
  const [wrapW, setWrapW] = useState(320);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWrapW(el.clientWidth || 320);
    const ro = new ResizeObserver((entries) => {
      setWrapW(entries[0].contentRect.width || 320);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [isTablet, setIsTablet] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsTablet(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const rowWidthUnits = (wrapW / (isTablet ? TABLET_ROW_HEIGHT_PX : ROW_HEIGHT_PX)) * UNIT_H;

  // No cache needed here the way WriteTextView needs one -- that one rebuilds on every
  // keystroke; this view's text only changes when textIndex changes (Prev/Next), so the
  // real stroke-geometry work happens at most once per text, not once per keystroke.
  const layout = useMemo(
    () => layoutTextIntoRows(text, lettersByLabel, connectorsByKey, rowWidthUnits, undefined, punctuationByLabel),
    [text, lettersByLabel, connectorsByKey, rowWidthUnits, punctuationByLabel]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "auto" });
  }, [textIndex]);

  const canPrev = textIndex > 0;
  const canNext = textIndex < texts.length - 1;

  const gridHeight = (layout.rowCount - 1) * TEXT_ROW_PITCH + UNIT_H;
  const diagonalLines = useMemo(
    () => buildDiagonalLines(gridHeight, rowWidthUnits, TEXT_ROW_DIAGONAL_SPACING),
    [gridHeight, rowWidthUnits]
  );

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
                viewBox={`0 0 ${rowWidthUnits} ${gridHeight}`}
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
                {diagonalLines.map((l, i) => (
                  <line key={`diag${i}`} x1={l.x1} y1={0} x2={l.x2} y2={gridHeight} stroke={GUIDE_COLOR} strokeWidth={GUIDE_DIAG_W} />
                ))}
                {Array.from({ length: layout.rowCount }, (_, rowIndex) =>
                  GUIDE_ROW_LINES.map((g, gi) => (
                    <line
                      key={`${rowIndex}_${gi}`}
                      x1="0" y1={rowIndex * TEXT_ROW_PITCH + g.y} x2={rowWidthUnits} y2={rowIndex * TEXT_ROW_PITCH + g.y}
                      stroke={GUIDE_COLOR}
                      strokeWidth={g.bold ? GUIDE_BOLD_W : GUIDE_THIN_W}
                    />
                  ))
                )}
                {layout.placed.map((p, i) => {
                  const wordWidth = p.segments.reduce((sum, seg) => sum + seg.width, 0);
                  const isActive = i === activeIndex;
                  return (
                    <g key={i} transform={`translate(${p.x} ${p.rowIndex * TEXT_ROW_PITCH})`}>
                      <rect
                        className="propis-text-word-hit"
                        x={-4} y={0} width={wordWidth + 8} height={TEXT_ROW_PITCH}
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
                        ) : seg.type === "glyph" ? (
                          // Real captured punctuation ink, but never animated (see
                          // buildPunctuationGlyph in wordEngine.js) — it's a standalone
                          // replacement for the fallback font glyph, not a letter that chains.
                          <g key={si} transform={`translate(${seg.xOffset} 0)`}>
                            {seg.strokes.map((s, ssi) => (
                              <path key={ssi} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            ))}
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
