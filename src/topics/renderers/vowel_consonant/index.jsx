import { useState, useRef, useCallback } from "react";
import "./vowel_consonant.css";

const ZONE_DEFS = [
  { id: "vowel",     label: "Гласные буквы",   color: "#ef4444" },
  { id: "consonant", label: "Согласные буквы", color: "#3b82f6" },
  { id: "sign",      label: "Знаки",           color: "#8b5cf6" },
];

export default function VowelConsonantRenderer({
  task,
  soundEnabled,
  playFeedback,
  onMistake,
  onAdvance,
}) {
  const letters = task?.letters ?? [];
  const hasSign = letters.some((l) => l.category === "sign");
  const zones   = hasSign ? ZONE_DEFS : ZONE_DEFS.slice(0, 2);

  const [placed,      setPlaced]      = useState({});
  const [dragPos,     setDragPos]     = useState(null);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [shaking,     setShaking]     = useState(false);

  const zoneRefs     = useRef({});
  const pointerIdRef = useRef(null);

  const remaining = letters.filter((l) => !placed[l.id]);
  const current   = remaining[0] ?? null;

  function detectZone(x, y) {
    for (const [id, el] of Object.entries(zoneRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }

  const handlePointerDown = useCallback((e) => {
    if (!current) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    pointerIdRef.current = e.pointerId;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, [current]);

  const handlePointerMove = useCallback((e) => {
    if (!dragPos || e.pointerId !== pointerIdRef.current) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    setHoveredZone(detectZone(e.clientX, e.clientY));
  }, [dragPos]);

  const handlePointerEnd = useCallback((e) => {
    if (e.pointerId !== pointerIdRef.current) return;
    if (!dragPos || !current) {
      setDragPos(null);
      return;
    }
    const zone = detectZone(e.clientX, e.clientY);
    setDragPos(null);
    setHoveredZone(null);
    pointerIdRef.current = null;

    if (!zone) return;

    if (zone === current.category) {
      const newPlaced = { ...placed, [current.id]: zone };
      setPlaced(newPlaced);
      if (soundEnabled) playFeedback?.("correct");
      if (letters.length - Object.keys(newPlaced).length === 0) {
        setTimeout(() => onAdvance?.(), 700);
      }
    } else {
      setShaking(true);
      if (soundEnabled) playFeedback?.("incorrect");
      onMistake?.(current.id, current.id);
      setTimeout(() => setShaking(false), 500);
    }
  }, [dragPos, current, placed, letters.length, soundEnabled, playFeedback, onMistake, onAdvance]);

  const done = remaining.length === 0;

  return (
    <div
      className="vc-screen"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className="vc-zones">
        {zones.map((zone) => (
          <div
            key={zone.id}
            ref={(el) => { zoneRefs.current[zone.id] = el; }}
            className={`vc-zone${hoveredZone === zone.id ? " vc-zone--active" : ""}`}
            style={{ "--zone-color": zone.color }}
          >
            {/* Jar cap — sits above the zone border */}
            <div className="vc-jar-cap" aria-hidden="true">
              <div className="vc-jar-lid" />
              <div className="vc-jar-ring" />
            </div>

            {/* Label sticker on the jar body */}
            <div className="vc-jar-label">{zone.label}</div>

            {/* Placed letter chips */}
            <div className="vc-zone-chips">
              {letters
                .filter((l) => placed[l.id] === zone.id)
                .map((l) => (
                  <span key={l.id} className="vc-chip">{l.letter}</span>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="vc-dock">
        {done ? (
          <div className="vc-done">Все буквы разложены!</div>
        ) : current && !dragPos ? (
          <div
            className={`vc-card${shaking ? " vc-card--shake" : ""}`}
            onPointerDown={handlePointerDown}
          >
            {current.letter}
          </div>
        ) : null}
      </div>

      {dragPos && current && (
        <div
          className="vc-card vc-card--floating"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          {current.letter}
        </div>
      )}
    </div>
  );
}
