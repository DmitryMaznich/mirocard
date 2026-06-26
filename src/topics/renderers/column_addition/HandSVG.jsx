import React from "react";
import "./fingers.css";

// Finger definitions for RIGHT hand display (left→right: pinky→thumb)
const FINGERS = [
  { x: 8,  topY: 34, w: 15, h: 58 },  // pinky
  { x: 27, topY: 20, w: 15, h: 72 },  // ring
  { x: 46, topY: 12, w: 15, h: 80 },  // middle
  { x: 65, topY: 22, w: 15, h: 70 },  // index
  { x: 83, topY: 46, w: 12, h: 50 },  // thumb
];

const PALM_Y   = 90;
const LOWER_DY = 85;

const COLOR_SOLID = "#FF6B35";
const COLOR_PALM  = "#FFAB85";

export default function HandSVG({ count = 0, ghost = 0, side = "right", animated = false }) {
  const mirrorTransform = side === "left" ? "scale(-1,1) translate(-112,0)" : undefined;

  return (
    <svg width="112" height="145" viewBox="0 0 112 145" aria-hidden="true">
      <g transform={mirrorTransform}>
        {FINGERS.map((f, i) => {
          const isSolid  = i < count;
          const isGhost  = !isSolid && i < count + ghost;
          const isLowered = !isSolid && !isGhost;
          const dy = isLowered ? LOWER_DY : 0;

          return (
            <g
              key={i}
              className={animated ? "fng-finger fng-finger--animated" : "fng-finger"}
              style={{ transform: `translateY(${dy}px)` }}
            >
              {isGhost ? (
                <rect
                  x={f.x} y={f.topY} width={f.w} height={f.h} rx={7}
                  fill="none"
                  stroke={COLOR_SOLID}
                  strokeWidth={2.5}
                  opacity={0.35}
                />
              ) : (
                <rect
                  x={f.x} y={f.topY} width={f.w} height={f.h} rx={7}
                  fill={isSolid ? COLOR_SOLID : "none"}
                />
              )}
            </g>
          );
        })}
        {/* Palm drawn on top to cover lowered finger stubs */}
        <rect x={3} y={PALM_Y} width={106} height={50} rx={10} fill={COLOR_PALM} />
        <rect x={20} y={132} width={72} height={13} rx={6} fill={COLOR_PALM} />
      </g>
    </svg>
  );
}
