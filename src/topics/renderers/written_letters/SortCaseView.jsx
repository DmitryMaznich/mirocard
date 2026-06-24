import { useState, useRef, useCallback } from "react";
import HandwrittenLetter from "./HandwrittenLetter";
import { LETTER_PATHS } from "./letterPaths.js";

const ZONE_DEFS = [
  { id: "upper", label: "Заглавные", color: "#6366f1" },
  { id: "lower", label: "Строчные",  color: "#0ea5e9" },
];

const CARD_SIZE = 160;

// Propis constants — match HandwrittenLetter.jsx
const L1 = 10, L2 = 62, L3 = 88, L4 = 140, VBH = 150;
const C_BG         = "#fefef6";
const C_LINE_OUTER = "#b8d8e8";
const C_LINE_TOP   = "#6ab4cc";
const C_LINE_BASE  = "#2a82a0";
const C_FONT       = "#1d4ed8";

// Zone layout: 3 letter slots per row, each slot 100 SVG units wide
const COLS      = 3;
const SLOT_W    = 100;
const ROW_W     = COLS * SLOT_W;       // 300 SVG units — fixed viewBox width
const INIT_ROWS = 2;                    // always show at least 2 empty rows
// Row-to-row pitch: L4 of row N = L1 of row N+1 (shared line)
const ROW_PITCH = L4 - L1;            // 130 SVG units

// Wrap chips into rows based on letter advance widths
function wrapChips(chips) {
  const rows = [];
  let row = [], cumX = 0;
  for (const chip of chips) {
    const w = LETTER_PATHS[chip.letter]?.vbW ?? SLOT_W;
    if (cumX + w > ROW_W && row.length > 0) {
      rows.push(row);
      row = [];
      cumX = 0;
    }
    row.push({ chip, x: cumX });
    cumX += w;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

function ZonePaper({ chips, isActive, zoneRef, label, color }) {
  const rows = wrapChips(chips);
  const numRows = Math.max(INIT_ROWS, rows.length);
  // totalH: top margin + N rows of pitch + bottom margin
  // Each adjacent pair of rows shares the L4/L1 line, so pitch = L4-L1 = 130
  const totalH = VBH + (numRows - 1) * ROW_PITCH;

  return (
    <div
      className={`wl-zone-paper${isActive ? " wl-zone-paper--active" : ""}`}
      ref={zoneRef}
      style={{ "--zone-color": color }}
    >
      <span className="wl-zone-paper__label">{label}</span>
      <svg
        viewBox={`0 0 ${ROW_W} ${totalH}`}
        width="100%"
        style={{ display: "block", height: "auto" }}
        aria-hidden="true"
      >
        <rect x={0} y={0} width={ROW_W} height={totalH} fill={C_BG} />
        {Array.from({ length: numRows }, (_, r) => {
          const dy = r * ROW_PITCH;
          return (
            <g key={r}>
              <line x1={0} y1={dy + L1} x2={ROW_W} y2={dy + L1} stroke={C_LINE_OUTER} strokeWidth={1.0} />
              <line x1={0} y1={dy + L2} x2={ROW_W} y2={dy + L2} stroke={C_LINE_TOP}   strokeWidth={1.0} />
              <line x1={0} y1={dy + L3} x2={ROW_W} y2={dy + L3} stroke={C_LINE_BASE}  strokeWidth={1.0} />
              <line x1={0} y1={dy + L4} x2={ROW_W} y2={dy + L4} stroke={C_LINE_OUTER} strokeWidth={1.0} />
            </g>
          );
        })}
        {rows.map((row, r) =>
          row.map(({ chip, x }) => {
            const d = LETTER_PATHS[chip.letter];
            if (!d) return null;
            return (
              <path
                key={`${r}-${x}`}
                d={d.path}
                fill={C_FONT}
                fillRule="nonzero"
                transform={`translate(${x}, ${r * ROW_PITCH})`}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

let _chips = { key: null, list: [] };

function getChips(key) {
  if (_chips.key !== key) _chips = { key, list: [] };
  return _chips.list;
}

function pushChip(key, chip) {
  if (_chips.key !== key) _chips = { key, list: [] };
  _chips.list = [..._chips.list, chip];
  return _chips.list;
}

export default function SortCaseView({ task, onAdvance, onCorrect, onMistake }) {
  const { letter, correctZone, sessionKey } = task;

  const chips = getChips(sessionKey);
  const [dragPos, setDragPos]   = useState(null);
  const [hovered, setHovered]   = useState(null);
  const [shaking, setShaking]   = useState(false);

  const screenRef    = useRef(null);
  const zoneRefs     = useRef({});
  const pointerIdRef = useRef(null);


  function detectZone(x, y) {
    for (const [id, el] of Object.entries(zoneRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    try { screenRef.current?.setPointerCapture(e.pointerId); } catch { /* not supported on all browsers */ }
    pointerIdRef.current = e.pointerId;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragPos || e.pointerId !== pointerIdRef.current) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    setHovered(detectZone(e.clientX, e.clientY));
  }, [dragPos]);

  const handlePointerEnd = useCallback((e) => {
    if (e.pointerId !== pointerIdRef.current) return;
    if (!dragPos) { setDragPos(null); return; }
    const zone = detectZone(e.clientX, e.clientY);
    setDragPos(null);
    setHovered(null);
    pointerIdRef.current = null;
    if (!zone) return;
    if (zone === correctZone) {
      pushChip(sessionKey, { zone, letter });
      onCorrect?.(letter, letter);
      onAdvance?.();
    } else {
      setShaking(true);
      onMistake?.(letter, letter);
      setTimeout(() => setShaking(false), 500);
    }
  }, [dragPos, correctZone, sessionKey, letter, onCorrect, onMistake, onAdvance]);

  return (
    <div
      ref={screenRef}
      className="wl-screen"
      style={{ touchAction: "none" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className="wl-dock">
        <div
          className={`wl-drag-card wl-letter-card wl-letter-card--lines${shaking ? " wl-drag-card--shake" : ""}`}
          style={{ visibility: dragPos ? "hidden" : "visible" }}
          onPointerDown={handlePointerDown}
        >
          <HandwrittenLetter letter={letter} size={CARD_SIZE} />
        </div>
      </div>

      <div className="wl-zones">
        {ZONE_DEFS.map((zone) => (
          <ZonePaper
            key={zone.id}
            chips={chips.filter((c) => c.zone === zone.id)}
            isActive={hovered === zone.id}
            zoneRef={(el) => { zoneRefs.current[zone.id] = el; }}
            label={zone.label}
            color={zone.color}
          />
        ))}
      </div>

      {dragPos && (
        <div
          className="wl-drag-card wl-drag-card--floating wl-letter-card wl-letter-card--lines"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          <HandwrittenLetter letter={letter} size={CARD_SIZE} />
        </div>
      )}
    </div>
  );
}
