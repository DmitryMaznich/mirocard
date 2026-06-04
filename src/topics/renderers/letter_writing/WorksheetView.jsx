import { useState, useRef, useEffect, useCallback } from "react";

const CELL_PX   = 36;   // base grid cell in pixels
const STROKE_W  = 10;
const TIP_R     = 4.5;
const SPEED     = 55;   // SVG units/sec

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Letter animation component ─────────────────────────────────────────────
function LetterCell({ letter, heightPx, replayKey }) {
  const svgRef    = useRef(null);
  const rafRef    = useRef(null);
  const timersRef = useRef([]);
  const lens      = useRef([]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const paths = svg.querySelectorAll("[data-ws-anim]");
    lens.current = Array.from(paths).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });

    // autoplay on mount and replay
    const t = setTimeout(() => play(svg), 80);
    timersRef.current.push(t);
    return stop;
  }, [letter.id, replayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function play(svg) {
    stop();
    const paths = svg.querySelectorAll("[data-ws-anim]");
    paths.forEach((el, i) => el.setAttribute("stroke-dashoffset", lens.current[i]));
    const tip = svg.querySelector("[data-ws-tip]");
    if (tip) tip.setAttribute("opacity", "0");

    const PAUSE = 250;

    function runStroke(i) {
      if (i >= letter.strokes.length) {
        if (tip) tip.setAttribute("opacity", "0");
        return;
      }
      const t = setTimeout(() => {
        animStroke(svg, i, tip, () => {
          const t2 = setTimeout(() => runStroke(i + 1), PAUSE);
          timersRef.current.push(t2);
        });
      }, PAUSE);
      timersRef.current.push(t);
    }

    const t0 = setTimeout(() => runStroke(0), 120);
    timersRef.current.push(t0);
  }

  function animStroke(svg, idx, tip, onDone) {
    const el  = svg.querySelector(`[data-ws-anim="${idx}"]`);
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

  const [, , vbW, vbH] = (letter.viewBox || "0 0 100 110").split(" ").map(Number);
  const svgH = heightPx;
  const svgW = Math.round(svgH * (vbW / vbH));

  return (
    <svg
      ref={svgRef}
      viewBox={letter.viewBox || "0 0 100 110"}
      width={svgW}
      height={svgH}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <marker id="lw-ws-arr" viewBox="0 0 9 7" refX="8.5" refY="3.5"
          markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="7" orient="auto">
          <path d="M 0,0 L 9,3.5 L 0,7 Z" fill="#fbbf24" opacity="0.85" />
        </marker>
      </defs>
      {/* ghost strokes with direction arrows */}
      {letter.strokes.map((s, i) => (
        <path key={`g${i}`} d={s.d} fill="none"
          stroke="#1d4ed8" strokeWidth={STROKE_W}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.15}
          markerEnd="url(#lw-ws-arr)" />
      ))}
      {/* animated strokes */}
      {letter.strokes.map((s, i) => (
        <path key={`a${i}`} data-ws-anim={i} d={s.d} fill="none"
          stroke="#1d4ed8" strokeWidth={STROKE_W}
          strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* pen tip */}
      <circle data-ws-tip r={TIP_R} cx="0" cy="0" fill="#fbbf24" opacity="0" />
    </svg>
  );
}

// ── Background SVG ─────────────────────────────────────────────────────────
function WorksheetBg({ totalHeightPx, widthPx, cellPx, background, marginX }) {
  const hLines = Math.ceil(totalHeightPx / cellPx) + 1;
  const vLines = Math.ceil(widthPx / cellPx) + 1;

  return (
    <svg
      className="lw-ws-bg-svg"
      viewBox={`0 0 ${widthPx} ${totalHeightPx}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: `${totalHeightPx}px`, pointerEvents: "none" }}
    >
      {/* horizontal lines */}
      {(background === "lined" || background === "grid") &&
        Array.from({ length: hLines }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * cellPx} x2={widthPx} y2={i * cellPx}
            stroke="#cde8f5" strokeWidth="0.8" />
        ))}
      {/* vertical lines */}
      {background === "grid" &&
        Array.from({ length: vLines }, (_, i) => (
          <line key={`v${i}`} x1={i * cellPx} y1={0} x2={i * cellPx} y2={totalHeightPx}
            stroke="#cde8f5" strokeWidth="0.8" />
        ))}
      {/* red margin */}
      <line x1={marginX} y1={0} x2={marginX} y2={totalHeightPx}
        stroke="#f4b8b8" strokeWidth="1.2" />
    </svg>
  );
}

// ── Main worksheet view ────────────────────────────────────────────────────
export default function WorksheetView({ task, onAdvance }) {
  const {
    letters       = [],
    background    = "lined",
    letterHeightCells = 2,
    blankRows     = 1,
  } = task;

  const letterHPx  = letterHeightCells * CELL_PX;
  const blankRowPx = CELL_PX;
  const guideRowPx = letterHPx + blankRows * blankRowPx;
  const marginX    = CELL_PX;

  // Build row list
  const rows = [];
  for (const letter of letters) {
    rows.push({ type: "guide", letter });
    for (let i = 0; i < blankRows; i++) {
      rows.push({ type: "blank" });
    }
  }

  const totalHeightPx = rows.reduce((sum, r) =>
    sum + (r.type === "guide" ? guideRowPx : blankRowPx), 0
  ) + CELL_PX * 3; // bottom padding

  const [replayKeys, setReplayKeys] = useState({});

  function tapLetter(key) {
    setReplayKeys((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  }

  const wrapRef  = useRef(null);
  const [wrapW, setWrapW] = useState(400);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWrapW(entries[0].contentRect.width || 400);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="lw-ws-wrap">
      <div
        className="lw-ws-paper"
        style={{ position: "relative", minHeight: `${totalHeightPx}px`, background: "#fefef6" }}
      >
        <WorksheetBg
          totalHeightPx={totalHeightPx}
          widthPx={wrapW}
          cellPx={CELL_PX}
          background={background}
          marginX={marginX}
        />

        <div className="lw-ws-rows" style={{ position: "relative", zIndex: 1 }}>
          {rows.map((row, idx) => {
            if (row.type === "blank") {
              return (
                <div
                  key={idx}
                  className="lw-ws-row lw-ws-row--blank"
                  style={{ height: blankRowPx }}
                />
              );
            }
            const key = `${row.letter.id}-${idx}`;
            return (
              <div
                key={idx}
                className="lw-ws-row lw-ws-row--guide"
                style={{ height: guideRowPx }}
              >
                {/* letter sample – tappable */}
                <button
                  type="button"
                  className="lw-ws-letter-btn"
                  style={{ width: letterHPx, height: letterHPx, marginLeft: marginX + 4 }}
                  onClick={() => tapLetter(key)}
                  aria-label={`Написание буквы ${row.letter.label}`}
                >
                  <LetterCell
                    letter={row.letter}
                    heightPx={letterHPx}
                    replayKey={replayKeys[key] || 0}
                  />
                </button>
                {/* write area */}
                <div className="lw-ws-write-area" />
              </div>
            );
          })}
        </div>

        {/* finish button */}
        <div className="lw-ws-footer">
          <button className="lw-btn lw-btn--done" onClick={onAdvance}>
            Завершить занятие
          </button>
        </div>
      </div>
    </div>
  );
}
