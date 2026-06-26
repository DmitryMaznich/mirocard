import React from "react";

export default function HandImg({ count = 0, ghost = 0, side = "right", style }) {
  const solidSrc  = `/hands/hand_${side}_${Math.min(count, 5)}.png`;
  const targetCnt = Math.min(count + ghost, 5);
  const showGhost = ghost > 0 && targetCnt !== count;

  return (
    <div style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      ...style,
    }}>
      <img
        src={solidSrc}
        alt={`${count}`}
        draggable={false}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
      />
      {showGhost && (
        <img
          src={`/hands/hand_${side}_${targetCnt}.png`}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            position: "absolute", inset: 0,
            maxWidth: "100%", maxHeight: "100%",
            objectFit: "contain",
            opacity: 0.28,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
