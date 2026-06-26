import React from "react";
import HandImg from "./HandImg.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

export default function FingersShowTask({ task, sessionParams, onCorrect, onPrevious }) {
  const hint = sessionParams?.hint !== false;
  const { right, left } = getFingerConfig(task.n);

  return (
    <div className="fng-screen fng-show-screen">
      <div className="fng-show-number">{task.n}</div>

      {hint && (
        <div className="fng-show-hands">
          <HandImg count={left}  side="left"  style={{ flex: 1, minWidth: 0, height: "100%" }} />
          <HandImg count={right} side="right" style={{ flex: 1, minWidth: 0, height: "100%" }} />
        </div>
      )}

      <div className="fng-show-buttons">
        <button className="fng-show-btn fng-show-btn--prev" onClick={onPrevious}>
          ← Назад
        </button>
        <button className="fng-show-btn fng-show-btn--next" onClick={onCorrect}>
          Следующая →
        </button>
      </div>
    </div>
  );
}
