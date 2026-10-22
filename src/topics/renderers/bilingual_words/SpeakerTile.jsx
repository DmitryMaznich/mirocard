// The two fixed "speakers" of the topic: home (Russian, warm frame, left) and
// school (Slovenian, blue frame, right). They never swap sides — the place
// itself is a cue. `state`: idle | speaking | hint (Russian is only a prompt
// now: dashed and dimmed until it speaks).

function HomeIcon() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M10 50 L50 14 L90 50 Z" fill="#c2570c" />
      <rect x="20" y="48" width="60" height="42" fill="#f6b26b" />
      <rect x="44" y="64" width="14" height="26" fill="#7c3a06" />
      <rect x="26" y="56" width="12" height="12" fill="#fff" />
      <rect x="64" y="56" width="12" height="12" fill="#fff" />
    </svg>
  );
}

function SchoolIcon() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="38" width="76" height="52" fill="#93b4f5" />
      <path d="M6 40 L50 14 L94 40 Z" fill="#2563eb" />
      <circle cx="50" cy="30" r="7" fill="#fff" />
      <rect x="20" y="48" width="12" height="12" fill="#fff" />
      <rect x="68" y="48" width="12" height="12" fill="#fff" />
      <rect x="42" y="66" width="16" height="24" fill="#1e3a8a" />
    </svg>
  );
}

function SpeakerBadge() {
  return (
    <span className="bw-tile__badge" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="#fff" />
        <path d="M16 8.5c1.2 1 1.8 2.2 1.8 3.5s-.6 2.5-1.8 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function SpeakerTile({ side, state = "idle", onTap, label }) {
  const home = side === "home";
  return (
    <button
      type="button"
      className={`bw-tile bw-tile--${side} bw-tile--${state}`}
      onClick={(event) => { event.stopPropagation(); onTap?.(); }}
      aria-label={label ?? (home ? "Дома: по-русски" : "В школе: по-словенски")}
    >
      {home ? <HomeIcon /> : <SchoolIcon />}
      {state === "speaking" && <SpeakerBadge />}
    </button>
  );
}
