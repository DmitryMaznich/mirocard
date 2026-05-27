import { useState, useRef, useCallback, useEffect } from "react";
import "./vowel_consonant.css";

const ZONE_DEFS = [
  { id: "vowel",     label: "Гласные буквы",   color: "#ef4444" },
  { id: "consonant", label: "Согласные буквы", color: "#3b82f6" },
  { id: "sign",      label: "Знаки",           color: "#8b5cf6" },
];

function VowelFaceHint() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="#fde68a" stroke="#f59e0b" strokeWidth="2"/>
      {/* cheeks */}
      <ellipse cx="26" cy="60" rx="11" ry="8" fill="#fca5a5" opacity="0.7"/>
      <ellipse cx="74" cy="60" rx="11" ry="8" fill="#fca5a5" opacity="0.7"/>
      {/* eyebrows raised */}
      <path d="M26 32 Q35 26 44 31" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M56 31 Q65 26 74 32" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round"/>
      {/* eyes wide */}
      <circle cx="36" cy="42" r="7" fill="#1e293b"/>
      <circle cx="64" cy="42" r="7" fill="#1e293b"/>
      <circle cx="38.5" cy="39.5" r="2.5" fill="#fff"/>
      <circle cx="66.5" cy="39.5" r="2.5" fill="#fff"/>
      {/* mouth — big open О */}
      <ellipse cx="50" cy="68" rx="16" ry="14" fill="#1e293b"/>
      <ellipse cx="50" cy="68" rx="11" ry="9"  fill="#dc2626"/>
      <ellipse cx="50" cy="72" rx="7" ry="5" fill="#f87171"/>
      {/* music notes */}
      <text x="8"  y="28" fontSize="16" fill="#f59e0b" fontWeight="bold">♪</text>
      <text x="76" y="24" fontSize="13" fill="#f59e0b" fontWeight="bold">♫</text>
    </svg>
  );
}

function ConsonantFaceHint() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="#dbeafe" stroke="#93c5fd" strokeWidth="2"/>
      {/* eyebrows furrowed */}
      <path d="M25 34 Q35 30 43 35" fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M57 35 Q65 30 75 34" fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round"/>
      {/* eyes squinting */}
      <path d="M28 44 Q36 39 44 44" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round"/>
      <path d="M56 44 Q64 39 72 44" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round"/>
      {/* clenched teeth mouth */}
      <rect x="30" y="62" width="40" height="14" rx="4" fill="#1e293b"/>
      <rect x="31" y="63" width="38" height="6"  rx="2" fill="#f1f5f9"/>
      <rect x="31" y="69" width="38" height="6"  rx="2" fill="#f1f5f9"/>
      {/* tooth dividers top row */}
      <line x1="40" y1="63" x2="40" y2="69" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="50" y1="63" x2="50" y2="69" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="60" y1="63" x2="60" y2="69" stroke="#cbd5e1" strokeWidth="1"/>
      {/* tooth dividers bottom row */}
      <line x1="36" y1="69" x2="36" y2="75" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="46" y1="69" x2="46" y2="75" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="56" y1="69" x2="56" y2="75" stroke="#cbd5e1" strokeWidth="1"/>
      {/* effort marks */}
      <line x1="16" y1="42" x2="22" y2="46" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round"/>
      <line x1="78" y1="46" x2="84" y2="42" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

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
      <rect x="43" y="72" width="14" height="22" rx="7" fill="#64748b" />
      <line x1="43.5" y1="78" x2="56.5" y2="78" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="43.5" y1="82" x2="56.5" y2="82" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="43.5" y1="86" x2="56.5" y2="86" stroke="#94a3b8" strokeWidth="1.2"/>
      <rect x="49" y="94" width="2" height="8" fill="#64748b" />
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

// Persists placed chips across task remounts (renderer remounts on each taskIndex change).
// Keyed by sessionKey so a new session always starts empty.
let _chipsStore = { key: null, chips: [] };

function getSessionChips(sessionKey) {
  if (_chipsStore.key !== sessionKey) {
    _chipsStore = { key: sessionKey, chips: [] };
  }
  return _chipsStore.chips;
}

function pushSessionChip(sessionKey, chip) {
  if (_chipsStore.key !== sessionKey) {
    _chipsStore = { key: sessionKey, chips: [] };
  }
  _chipsStore.chips = [..._chipsStore.chips, chip];
  return _chipsStore.chips;
}

export default function VowelConsonantRenderer({
  task,
  soundEnabled,
  onMistake,
  onCorrect,
  onAdvance,
}) {
  const letter     = task?.letter     ?? "";
  const category   = task?.category   ?? "";
  const singCheck  = task?.singCheck  ?? false;
  const hasSign    = task?.hasSign    ?? false;
  const sessionKey = task?.sessionKey ?? "";
  const zones      = hasSign ? ZONE_DEFS : ZONE_DEFS.slice(0, 2);

  const chips = getSessionChips(sessionKey);
  const [dragPos,     setDragPos]     = useState(null);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [shaking,     setShaking]     = useState(false);
  const [faceState,   setFaceState]   = useState("idle");

  const zoneRefs     = useRef({});
  const singFaceRef  = useRef(null);
  const screenRef    = useRef(null);
  const pointerIdRef = useRef(null);
  const audioRef     = useRef(null);

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
    e.preventDefault();
    try { screenRef.current?.setPointerCapture(e.pointerId); } catch {}
    pointerIdRef.current = e.pointerId;
    setDragPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragPos || e.pointerId !== pointerIdRef.current) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    setHoveredZone(detectZone(e.clientX, e.clientY));
  }, [dragPos]);

  function playSingSound(ltr, cat) {
    if (!soundEnabled) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(`/sounds/letters/${ltr}.mp3`);
    audioRef.current = audio;
    audio.play().catch(() => {});
    const duration = cat === "vowel" ? 2200 : 1200;
    setFaceState(cat === "vowel" ? "vowel" : "consonant");
    setTimeout(() => setFaceState("idle"), duration);
  }

  // Stop audio when task changes or component unmounts
  useEffect(() => () => { audioRef.current?.pause(); }, [task]);

  const handlePointerEnd = useCallback((e) => {
    if (e.pointerId !== pointerIdRef.current) return;
    if (!dragPos) {
      setDragPos(null);
      return;
    }
    const zone = detectZone(e.clientX, e.clientY);
    setDragPos(null);
    setHoveredZone(null);
    pointerIdRef.current = null;

    if (!zone) return;

    if (zone === "sing") {
      playSingSound(letter, category);
      return;
    }

    if (zone === category) {
      pushSessionChip(sessionKey, { letter, zoneId: zone });
      onCorrect?.(letter, letter);
      onAdvance?.();
    } else {
      setShaking(true);
      onMistake?.(letter, letter);
      setTimeout(() => setShaking(false), 500);
    }
  }, [dragPos, letter, category, sessionKey, onCorrect, onMistake, onAdvance]);

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
        {!dragPos && (
          <div
            className={`vc-card${shaking ? " vc-card--shake" : ""}`}
            onPointerDown={handlePointerDown}
          >
            {letter}
          </div>
        )}
        {singCheck && (
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
              {zone.id === "vowel"     && <div className="vc-jar-hint"><VowelFaceHint /></div>}
              {zone.id === "consonant" && <div className="vc-jar-hint"><ConsonantFaceHint /></div>}
              <div className="vc-zone-chips">
                {chips
                  .filter((c) => c.zoneId === zone.id)
                  .map((c, i) => (
                    <span key={i} className="vc-chip">{c.letter}</span>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {dragPos && (
        <div
          className="vc-card vc-card--floating"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          {letter}
        </div>
      )}
    </div>
  );
}
