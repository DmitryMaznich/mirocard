import React from "react";

export default function HandImg({ count = 0, ghost = 0, side = "right", style }) {
  const solidSrc  = `/hands/hand_${side}_${Math.min(count, 5)}.png`;
  const targetCnt = Math.min(count + ghost, 5);
  const showGhost = ghost > 0 && targetCnt !== count;

  return (
    <div style={{ position: "relative", display: "block", ...style }}>
      <img
        src={solidSrc}
        alt={`${count}`}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
      {showGhost && (
        <img
          src={`/hands/hand_${side}_${targetCnt}.png`}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%", objectFit: "contain",
            opacity: 0.28,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
