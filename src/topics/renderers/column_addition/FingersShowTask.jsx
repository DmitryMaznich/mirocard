import React from "react";
import HandImg from "./HandImg.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

export default function FingersShowTask({ task, sessionParams, onCorrect }) {
  const hint = sessionParams?.hint !== false;
  const { right, left } = getFingerConfig(task.n);

  return (
    <div className="fng-screen">
      <div className="fng-number">{task.n}</div>

      {hint && (
        <div className="fng-hands-row">
          <HandImg count={left}  side="left" />
          <HandImg count={right} side="right" />
        </div>
      )}

      <button className="fng-btn fng-btn--next" onClick={onCorrect}>
        → Следующая
      </button>
    </div>
  );
}
