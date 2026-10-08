import React from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import { BackArrowIcon, ForwardArrowIcon } from "@/shared/components/ArrowIcons";
import "./fingers.css";

export default function FingersShowTask({ task, sessionParams, onCorrect, onPrevious }) {
  const hint = sessionParams?.hint !== false;
  const { right, left } = getFingerConfig(task.n);

  return (
    <div className="fng-show-screen">
      <div className="fng-show-number-zone">
        <div className="fng-show-number">{task.n}</div>
      </div>

      {hint && (
        <div className="fng-show-hands">
          <AnimatedHand count={left}  side="right" style={{ flex: 1, minWidth: 0, height: "100%" }} />
          <AnimatedHand count={right} side="left"  style={{ flex: 1, minWidth: 0, height: "100%" }} />
        </div>
      )}

      <div className="fng-show-buttons">
        <button className="fng-show-btn fng-show-btn--prev" onClick={onPrevious}>
          <BackArrowIcon size={16} /> Назад
        </button>
        <button className="fng-show-btn fng-show-btn--next" onClick={onCorrect}>
          Следующая <ForwardArrowIcon size={16} />
        </button>
      </div>
    </div>
  );
}
