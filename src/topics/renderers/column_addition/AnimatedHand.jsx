import { useEffect, useRef, useState } from "react";
import { HAND_PATHS } from "./handShapes";

const TRANSITION_MS = 550;

function HandLayer({ n, mirror, style }) {
  const shape = HAND_PATHS[Math.max(0, Math.min(5, n))];
  return (
    <svg
      viewBox="0 0 256 320"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", ...style }}
    >
      <g transform={mirror ? "translate(256,0) scale(-1,1)" : undefined}>
        <path d={shape.fill} fill="#FBBF8A" />
        <path d={shape.line} fill="#5b280f" fillRule="evenodd" />
      </g>
    </svg>
  );
}

// Vector replacement for the old raster HandImg: cross-fades between finger
// counts with a spring scale (same effect rehearsed in the fist/open mockup)
// instead of a hard image swap.
export default function AnimatedHand({ count = 0, side = "right", style, animated = true }) {
  const clamped = Math.max(0, Math.min(5, count));
  const [from, setFrom] = useState(clamped);
  const [to, setTo] = useState(clamped);
  const [active, setActive] = useState(true);
  const timeoutRef = useRef(null);
  const mirror = side === "left";

  useEffect(() => {
    if (!animated || clamped === to) return;
    // Kicking off a CSS transition needs from/to snapshotted and a delayed
    // settle via rAF/setTimeout — genuinely effect work, not derivable at render time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom(to);
    setTo(clamped);
    setActive(false);
    const raf = requestAnimationFrame(() => setActive(true));
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFrom(clamped), TRANSITION_MS);
    return () => { cancelAnimationFrame(raf); clearTimeout(timeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  const idle = !animated || from === to;

  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }}>
      {idle ? (
        <HandLayer n={animated ? to : clamped} mirror={mirror} />
      ) : (
        <>
          <HandLayer
            n={from}
            mirror={mirror}
            style={{
              opacity: active ? 0 : 1,
              transform: active ? "scale(.95)" : "scale(1)",
              transition: `opacity ${TRANSITION_MS}ms cubic-bezier(.4,0,.2,1), transform ${TRANSITION_MS}ms cubic-bezier(.4,0,.2,1)`,
            }}
          />
          <HandLayer
            n={to}
            mirror={mirror}
            style={{
              opacity: active ? 1 : 0,
              transform: active ? "scale(1)" : "scale(1.06)",
              transition: `opacity ${TRANSITION_MS}ms cubic-bezier(.34,1.3,.6,1), transform ${TRANSITION_MS}ms cubic-bezier(.34,1.3,.6,1)`,
            }}
          />
        </>
      )}
    </div>
  );
}
