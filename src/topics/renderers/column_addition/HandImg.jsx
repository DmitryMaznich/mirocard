import React from "react";

const W = 120;
const H = 150;

export default function HandImg({ count = 0, ghost = 0, side = "right" }) {
  const solidSrc  = `/hands/hand_${side}_${Math.min(count, 5)}.png`;
  const targetCnt = Math.min(count + ghost, 5);
  const showGhost = ghost > 0 && targetCnt !== count;

  return (
    <div style={{ position: "relative", display: "inline-block", width: W, height: H, flexShrink: 0 }}>
      <img
        src={solidSrc}
        alt={`${count}`}
        draggable={false}
        style={{ width: W, height: H, display: "block", objectFit: "contain" }}
      />
      {showGhost && (
        <img
          src={`/hands/hand_${side}_${targetCnt}.png`}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            position: "absolute", top: 0, left: 0,
            width: W, height: H, objectFit: "contain",
            opacity: 0.28,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
