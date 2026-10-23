import { useEffect, useRef, useState } from "react";
import { useRewardSettings } from "@/features/rewards/useRewardSettings.js";
import "@/features/rewards/rewards.css";
import "./streakTracker.css";

// Legacy keeps its 5/10/15 individual stars. The opt-in policy uses the same
// five grouped stars as the header, so a one-star penalty always looks identical.
export default function StreakTrackerRenderer({ task, onCorrect, onIncorrect, streakCount = 0, answersPerStar = 1, rewardChangeReason, rewardSettings }) {
  const currentSettings = useRewardSettings();
  const settings = rewardSettings ?? currentSettings;
  const starsTarget = settings.algorithm === "flexible" ? 5 : 5 * answersPerStar;
  const litCount = Math.min(starsTarget, settings.algorithm === "flexible" ? Math.floor(streakCount / answersPerStar) : streakCount);
  const previousCount = useRef(litCount);
  const [burning, setBurning] = useState([]);
  useEffect(() => {
    const previous = previousCount.current;
    previousCount.current = litCount;
    if (settings.algorithm !== "flexible" || rewardChangeReason === "exchange" || litCount >= previous) {
      setBurning([]);
      return;
    }
    setBurning(Array.from({ length: previous - litCount }, (_, i) => litCount + i));
    const timer = setTimeout(() => setBurning([]), 750);
    return () => clearTimeout(timer);
  }, [litCount, settings.algorithm, rewardChangeReason]);
  if (!task) return null;
  // Explicit rows of 5 (1/2/3 rows for the 5/10/15 options) instead of
  // leaving a single flex-wrap row to break wherever the screen width
  // happens to allow — keeps the "5" grouping visible and the layout the
  // same on every screen size, not just whichever count fits per line.
  const rows = [];
  for (let start = 0; start < starsTarget; start += 5) rows.push(start);
  return (
    <div className="operation-stage operation-stage--manual streak-tracker-stage" style={{ "--streak-rows": rows.length }}>
      <div className={`operation-manual__stars-rows${starsTarget > 5 ? " operation-manual__stars-rows--compact" : ""}`}>
        {rows.map((start) => (
          <div key={start} className="operation-manual__stars">
            {Array.from({ length: 5 }, (_, j) => {
              const i = start + j;
              return (
                <span
                  key={i}
                  className={`operation-manual__star${i < litCount ? " operation-manual__star--lit" : ""}${burning.includes(i) ? settings.animation === "soft" ? " operation-manual__star--soft-burn" : " operation-manual__star--burn" : ""}`}
                >★</span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="operation-manual__btns">
        <button
          type="button"
          className="operation-manual__btn operation-manual__btn--wrong"
          onClick={() => onIncorrect(task.conceptId, task.cardId)}
          aria-label="Неверно"
        >✗</button>
        <button
          type="button"
          className="operation-manual__btn operation-manual__btn--correct"
          onClick={() => onCorrect(task.conceptId, task.cardId)}
          aria-label="Верно"
        >✓</button>
      </div>
    </div>
  );
}
