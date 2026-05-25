import { useState, useRef, useCallback, useEffect } from "react";
import "./vowel_consonant.css";

const ZONE_DEFS = [
  { id: "vowel",     label: "Гласные буквы",   color: "#ef4444" },
  { id: "consonant", label: "Согласные буквы", color: "#3b82f6" },
  { id: "sign",      label: "Знаки",           color: "#8b5cf6" },
];

// Mouth path variants for the sing face
const MOUTH = {
  idle:      "M 30 58 Q 50 66 70 58",
  hover:     "M 34 57 Q 50 70 66 57",
  vowel:     "M 32 54 Q 50 76 68 54 Q 50 64 32 54",
  consonant: "M 35 60 Q 50 57 65 60",
};

function SingFace({ state }) {
  return (
    <svg className="vc-sing-face" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="#fde68a" stroke="#f59e0b" strokeWidth="3" />
      {/* eyes */}
      <circle cx="34" cy="40" r="5" fill="#1e293b" />
      <circle cx="66" cy="40" r="5" fill="#1e293b" />
      {/* eye shine */}
      <circle cx="36" cy="38" r="2" fill="#fff" />
      <circle cx="68" cy="38" r="2" fill="#fff" />
      {/* mouth */}
      <path
        d={MOUTH[state] ?? MOUTH.idle}
        fill={state === "vowel" ? "#1e293b" : "none"}
        stroke="#1e293b"
        strokeWidth="3.5"
        strokeLinecap="round"
        style={{ transition: "d 0.2s ease" }}
      />
      {/* tongue visible when vowel */}
      {state === "vowel" && (
        <ellipse cx="50" cy="67" rx="8" ry="5" fill="#f87171" />
      )}
      {/* music notes when vowel */}
      {state === "vowel" && (
        <>
          <text x="18" y="28" fontSize="14" fill="#f59e0b" style={{ fontWeight: 700 }}>♪</text>
          <text x="70" y="24" fontSize="11" fill="#f59e0b" style={{ fontWeight: 700 }}>♫</text>
        </>
      )}
    </svg>
  );
}

export default function VowelConsonantRenderer({
  task,
  soundEnabled,
  playFeedback,
  onMistake,
  onAdvance,
}) {
  const letters    = task?.letters ?? [];
  const singCheck  = task?.singCheck ?? false;
  const hasSign    = letters.some((l) => l.category === "sign");
  const zones      = hasSign ? ZONE_DEFS : ZONE_DEFS.slice(0, 2);

  const [placed,      setPlaced]      = useState({});
  const [dragPos,     setDragPos]     = useState(null);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [shaking,     setShaking]     = useState(false);
  const [faceState,   setFaceState]   = useState("idle");

  const zoneRefs     = useRef({});
  const singFaceRef  = useRef(null);
  const screenRef    = useRef(null);
  const pointerIdRef = useRef(null);
  const audioRef     = useRef(null);

  const remaining = letters.filter((l) => !placed[l.id]);
  const current   = remaining[0] ?? null;

  function detectZone(x, y) {
    for (const [id, el] of Object.entries(zoneRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    if (singCheck && singFaceRef.current) {
      const r = singFaceRef.current.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return "sing";
    }
    return null;
  }

  const handlePointerDown = useCallback((e) => {
    if (!current) return;
    e.preventDefault();
    try { screenRef.current?.setPointerCapture(e.pointerId); } catch {}
    pointerIdRef.current = e.pointerId;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, [current]);

  const handlePointerMove = useCallback((e) => {
    if (!dragPos || e.pointerId !== pointerIdRef.current) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    setHoveredZone(detectZone(e.clientX, e.clientY));
  }, [dragPos]);

  function playSingSound(letter, category) {
    if (!soundEnabled) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(`/sounds/letters/${letter}.mp3`);
    audioRef.current = audio;
    audio.play().catch(() => {});
    const duration = category === "vowel" ? 2200 : 1200;
    const newState = category === "vowel" ? "vowel" : "consonant";
    setFaceState(newState);
    setTimeout(() => setFaceState("idle"), duration);
  }

  // Stop audio when task changes or component unmounts
  useEffect(() => () => { audioRef.current?.pause(); }, [task]);

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

    if (zone === "sing") {
      playSingSound(current.letter, current.category);
      return;
    }

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
  const onFace = hoveredZone === "sing";

  return (
    <div
      ref={screenRef}
      className="vc-screen"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className={`vc-dock${singCheck ? " vc-dock--with-face" : ""}`}>
        {done ? (
          <div className="vc-done">Все буквы разложены!</div>
        ) : (
          <>
            {current && !dragPos ? (
              <div
                className={`vc-card${shaking ? " vc-card--shake" : ""}`}
                onPointerDown={handlePointerDown}
              >
                {current.letter}
              </div>
            ) : (
              !done && <div className="vc-card-placeholder" />
            )}
            {singCheck && (
              <div
                ref={singFaceRef}
                className={`vc-sing-wrap${onFace ? " vc-sing-wrap--hover" : ""}`}
              >
                <SingFace state={onFace ? "hover" : faceState} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="vc-zones">
        {zones.map((zone) => (
          <div
            key={zone.id}
            ref={(el) => { zoneRefs.current[zone.id] = el; }}
            className={`vc-zone-wrap${hoveredZone === zone.id ? " vc-zone-wrap--active" : ""}`}
            style={{ "--zone-color": zone.color }}
          >
            <div className="vc-jar-cap" aria-hidden="true">
              <div className="vc-jar-lid" />
              <div className="vc-jar-neck">
                <span className="vc-jar-label">{zone.label}</span>
              </div>
            </div>
            <div className="vc-jar-body">
              <div className="vc-zone-chips">
                {letters
                  .filter((l) => placed[l.id] === zone.id)
                  .map((l) => (
                    <span key={l.id} className="vc-chip">{l.letter}</span>
                  ))}
              </div>
            </div>
          </div>
        ))}
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
