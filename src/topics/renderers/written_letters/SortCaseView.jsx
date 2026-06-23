import { useState, useRef, useCallback } from "react";
import HandwrittenLetter from "./HandwrittenLetter";

const ZONE_DEFS = [
  { id: "upper", label: "Заглавные", color: "#6366f1" },
  { id: "lower", label: "Строчные",  color: "#0ea5e9" },
];

const CARD_SIZE = 100;

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
        {!dragPos && (
          <div
            className={`wl-drag-card wl-letter-card wl-letter-card--lines${shaking ? " wl-drag-card--shake" : ""}`}
            onPointerDown={handlePointerDown}
          >
            <HandwrittenLetter letter={letter} size={CARD_SIZE} />
          </div>
        )}
      </div>

      <div className="wl-zones">
        {ZONE_DEFS.map((zone) => (
          <div
            key={zone.id}
            ref={(el) => { zoneRefs.current[zone.id] = el; }}
            className={`wl-zone${hovered === zone.id ? " wl-zone--active" : ""}`}
            style={{ "--zone-color": zone.color }}
          >
            <span className="wl-zone-label">{zone.label}</span>
            <div className="wl-zone-chips">
              {chips
                .filter((c) => c.zone === zone.id)
                .map((c, i) => (
                  <div key={i} className="wl-zone-chip">{c.letter}</div>
                ))}
            </div>
          </div>
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
