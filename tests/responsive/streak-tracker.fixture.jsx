import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import SessionHeader from "../../src/features/session/SessionHeader.jsx";
import StreakTrackerRenderer from "../../src/topics/renderers/streak_tracker/index.jsx";
import "../../src/styles.css";

const params = new URLSearchParams(location.search);
const answersPerStar = Number(params.get("perStar") || 1);
const initialCount = Number(params.get("count") || 0);
document.documentElement.classList.add("app-ios-standalone");
for (const side of ["top", "right", "bottom", "left"]) {
  document.documentElement.style.setProperty(`--app-safe-${side}`, `${Number(params.get(side) || 0)}px`);
}

function Fixture() {
  const [streakCount, setStreakCount] = useState(initialCount);
  const [answerStatus, setAnswerStatus] = useState(null);
  return (
    <div className="session-screen">
      <div className="session-header-wrap">
        <SessionHeader topicTitle="5 из 5" modeTitle="5 из 5" showProgress showStreak
          streakCount={streakCount} rewardAvailable answersPerStar={answersPerStar}
          taskIndex={0} total={15} correctCount={streakCount} incorrectCount={0}
          evaluation="instant" answerStatus={answerStatus} onClose={() => {}} onOpenModeSettings={() => {}} />
      </div>
      <div className="session-renderer-wrap">
        <StreakTrackerRenderer task={{ conceptId: "streak_task", cardId: "streak_task" }}
          streakCount={streakCount} answersPerStar={answersPerStar}
          onCorrect={() => { setStreakCount(count => count + 1); setAnswerStatus("answer_correct"); }}
          onIncorrect={() => { setStreakCount(0); setAnswerStatus("answer_incorrect"); }} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
