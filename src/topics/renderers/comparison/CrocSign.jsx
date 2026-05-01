export default function CrocSign({ state = "closed" }) {
  const isEqual   = state === "equal";
  const openRight = state === "open-right";
  const topAngle  = openRight ? -28 : (state === "open-left" ?  28 : 0);
  const botAngle  = openRight ?  28 : (state === "open-left" ? -28 : 0);
  const topShift  = isEqual ? -5 : 0;
  const botShift  = isEqual ?  5 : 0;
  const flipX     = state === "open-left" ? "scaleX(-1)" : "";

  return (
    <svg viewBox="0 0 80 80" width={64} height={64}
      style={{ transform: flipX, transition: "transform 0.1s" }}>
      <g style={{
        transform: `rotate(${topAngle}deg) translateY(${topShift}px)`,
        transformOrigin: "20px 40px",
        transition: "transform 0.5s cubic-bezier(0.34,1.3,0.64,1)",
      }}>
        <rect x="10" y="28" width="60" height="14" rx="3" fill="#66bb6a" />
        {[20, 32, 44, 56].map((x) => (
          <polygon key={x} points={`${x},42 ${x + 5},42 ${x + 2.5},48`} fill="#fff" />
        ))}
        <circle cx="24" cy="26" r="4" fill="#fff" />
        <circle cx="24" cy="26" r="2" fill="#333" />
        <circle cx="34" cy="26" r="4" fill="#fff" />
        <circle cx="34" cy="26" r="2" fill="#333" />
      </g>
      <g style={{
        transform: `rotate(${botAngle}deg) translateY(${botShift}px)`,
        transformOrigin: "20px 40px",
        transition: "transform 0.5s cubic-bezier(0.34,1.3,0.64,1)",
      }}>
        <rect x="10" y="40" width="60" height="14" rx="3" fill="#43a047" />
        {[20, 32, 44, 56].map((x) => (
          <polygon key={x} points={`${x},40 ${x + 5},40 ${x + 2.5},34`} fill="#fff" />
        ))}
      </g>
    </svg>
  );
}
