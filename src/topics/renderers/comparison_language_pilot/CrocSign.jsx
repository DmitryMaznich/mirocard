export default function CrocSign({ state = "closed", size = 100 }) {
  const isOpen  = state === "open-right" || state === "open-left";
  const isEqual = state === "equal";
  const upperTransform = isEqual ? "translateY(-13px)" : isOpen ? "rotate(-28deg)" : "none";
  const lowerTransform = isEqual ? "translateY(13px)"  : isOpen ? "rotate(28deg)"  : "none";
  const pivot  = "20px 80px";
  const spring = "transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1)";
  const TEETH  = [26, 42, 58, 74, 90, 106, 122];

  return (
    <div style={{
      transform: state === "open-left" ? "scaleX(-1)" : "none",
      transition: "transform 0.15s",
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <svg width={size} height={size} viewBox="0 0 160 160" style={{ overflow: "visible" }} aria-hidden="true">
        {/* Upper jaw — bottom edge at y=80 */}
        <g style={{ transformOrigin: pivot, transform: upperTransform, transition: spring }}>
          <rect x="20" y="50" width="120" height="30" rx="8" fill="#66bb6a" />
          {/* Left eye: bottom of socket at y=50 (jaw top line), eye rests on jaw */}
          <circle cx="52" cy="33" r="17" fill="#388e3c" />
          <circle cx="52" cy="33" r="13" fill="white"   />
          <circle cx="52" cy="33" r="8"  fill="#1a1a2e" />
          <circle cx="56" cy="29" r="3"  fill="rgba(255,255,255,0.9)" />
          {/* Right eye */}
          <circle cx="96" cy="33" r="17" fill="#388e3c" />
          <circle cx="96" cy="33" r="13" fill="white"   />
          <circle cx="96" cy="33" r="8"  fill="#1a1a2e" />
          <circle cx="100" cy="29" r="3" fill="rgba(255,255,255,0.9)" />
          {/* Upper teeth pointing down */}
          {TEETH.map((x) => (
            <polygon key={x} points={`${x},80 ${x+10},80 ${x+5},96`} fill="white" />
          ))}
        </g>
        {/* Lower jaw — top edge at y=80 */}
        <g style={{ transformOrigin: pivot, transform: lowerTransform, transition: spring }}>
          <rect x="20" y="80" width="120" height="30" rx="8" fill="#43a047" />
          {/* Lower teeth pointing up */}
          {TEETH.map((x) => (
            <polygon key={x} points={`${x},80 ${x+10},80 ${x+5},64`} fill="white" />
          ))}
        </g>
      </svg>
    </div>
  );
}
