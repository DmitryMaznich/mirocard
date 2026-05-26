import { useState, useRef, useCallback, useEffect } from "react";
import "./vowel_consonant.css";

const ZONE_DEFS = [
  { id: "vowel",     label: "Гласные буквы",   color: "#ef4444" },
  { id: "consonant", label: "Согласные буквы", color: "#3b82f6" },
  { id: "sign",      label: "Знаки",           color: "#8b5cf6" },
];

// Face+mic: viewBox 0 0 100 130 — face top, mic bottom
const MOUTH = {
  idle:      "M 40 46 Q 50 52 60 46",
  hover:     "M 38 44 Q 50 55 62 44",
  vowel:     "M 38 41 Q 50 62 62 41 Q 50 52 38 41",
  consonant: "M 41 48 Q 50 44 59 48",
};

function SingFace({ state }) {
  const isVowel = state === "vowel";
  const isCons  = state === "consonant";
  return (
    <svg className="vc-sing-face" viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg">
      {/* ── face ── */}
      <circle cx="50" cy="36" r="31" fill="#fde68a" stroke="#f59e0b" strokeWidth="2.5" />
      {/* eyes — squint when consonant */}
      {isCons ? (
        <>
          <path d="M 37 30 Q 41 27 45 30" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M 55 30 Q 59 27 63 30" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <circle cx="41" cy="30" r="4" fill="#1e293b" />
          <circle cx="59" cy="30" r="4" fill="#1e293b" />
          <circle cx="42.5" cy="28.5" r="1.5" fill="#fff" />
          <circle cx="60.5" cy="28.5" r="1.5" fill="#fff" />
        </>
      )}
      {/* mouth */}
      <path
        d={MOUTH[state] ?? MOUTH.idle}
        fill={isVowel ? "#1e293b" : "none"}
        stroke="#1e293b"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {isVowel && <ellipse cx="50" cy="54" rx="7" ry="4" fill="#f87171" />}

      {/* ── microphone ── */}
      {/* body */}
      <rect x="43" y="72" width="14" height="22" rx="7" fill="#64748b" />
      {/* grille lines */}
      <line x1="43.5" y1="78" x2="56.5" y2="78" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="43.5" y1="82" x2="56.5" y2="82" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="43.5" y1="86" x2="56.5" y2="86" stroke="#94a3b8" strokeWidth="1.2"/>
      {/* stand stem */}
      <rect x="49" y="94" width="2" height="8" fill="#64748b" />
      {/* stand base */}
      <path d="M 42 102 Q 50 108 58 102" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"/>

      {/* ── music notes float when vowel ── */}
      {isVowel && (
        <>
          <text x="10" y="22" fontSize="13" fill="#f59e0b" fontWeight="bold">♪</text>
          <text x="74" y="18" fontSize="10" fill="#f59e0b" fontWeight="bold">♫</text>
          <text x="68" y="60" fontSize="10" fill="#f59e0b" fontWeight="bold">♪</text>
        </>
      )}
      {/* ── X marks when consonant ── */}
      {isCons && (
        <>
          <line x1="14" y1="56" x2="22" y2="64" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="22" y1="56" x2="14" y2="64" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
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
      <div className="vc-dock">
        {done ? (
          <div className="vc-done">Все буквы разложены!</div>
        ) : (
          current && !dragPos ? (
            <div
              className={`vc-card${shaking ? " vc-card--shake" : ""}`}
              onPointerDown={handlePointerDown}
            >
              {current.letter}
            </div>
          ) : null
        )}
        {singCheck && !done && (
          <div
            ref={singFaceRef}
            className={`vc-sing-wrap${onFace ? " vc-sing-wrap--hover" : ""}`}
          >
            <SingFace state={onFace ? "hover" : faceState} />
          </div>
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
