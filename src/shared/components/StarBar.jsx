import { useRewardSettings } from "@/features/rewards/useRewardSettings.js";
import { playRewardStarSound } from "@/features/rewards/starFeedback.js";
import "@/features/rewards/rewards.css";
import { useRef, useEffect, useState } from "react";
import { computeStreakProgress } from "@/features/session/useStarProgress";

const STAR_COUNT = 5;
const BURN_MS = 750;
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export default function StarBar({ className = "", streakCount = 0, available, answersPerStar = 1, changeReason, settingsOverride }) {
  const currentSettings = useRewardSettings();
  const rewardSettings = settingsOverride ?? currentSettings;
  const flexible = rewardSettings.algorithm === "flexible";
  const { litStars } = computeStreakProgress({ streakCount, available, answersPerStar });

  const prevLitRef = useRef(litStars);
  const [animState, setAnimState] = useState({ gainIdx: null, loseIndices: [] });

  useEffect(() => {
    const prev = prevLitRef.current;
    prevLitRef.current = litStars;
    if (litStars === prev || !available) return;
    if (flexible && changeReason === "exchange") {
      setAnimState({ gainIdx: null, loseIndices: [] });
      return;
    }
    if (rewardSettings.sound) playRewardStarSound();
    if (litStars > prev) {
      setAnimState({ gainIdx: litStars - 1, loseIndices: [] });
      const t = setTimeout(() => setAnimState({ gainIdx: null, loseIndices: [] }), 500);
      return () => clearTimeout(t);
    }
    setAnimState({ gainIdx: null, loseIndices: flexible ? Array.from({ length: prev - litStars }, (_, i) => litStars + i) : [prev - 1] });
    const t = setTimeout(() => setAnimState({ gainIdx: null, loseIndices: [] }), BURN_MS);
    return () => clearTimeout(t);
  }, [litStars, changeReason, available, flexible, rewardSettings.sound]);

  if (!available) return null;

  const { gainIdx, loseIndices } = animState;
  const isBurning = loseIndices.length > 0;

  return (
    <div className={`star-bar-zone ${isBurning ? "star-bar-zone--shake" : ""} ${className} ${rewardSettings.animation === "soft" ? "star-bar-zone--soft" : ""}`}>
      {answersPerStar > 1 && (
        <span className="star-bar-multiplier">×{answersPerStar}</span>
      )}
      <div className="star-bar-stars">
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const isLit  = i < litStars;
          const isGain = i === gainIdx;
          const isLose = loseIndices.includes(i);
          return (
            <span key={i} className="star-bar-star-wrap">
              <span
                className={[
                  "star-bar-star",
                  isLit  ? "star-bar-star--lit"  : "star-bar-star--dim",
                  isGain ? "star-bar-star--gain" : "",
                ].filter(Boolean).join(" ")}
              >★</span>
              {isLose && (
                <>
                  <span className="star-bar-burn-flash" />
                  <span className="star-bar-star star-bar-star--burn">★</span>
                  {SPARK_ANGLES.map((deg, i) => (
                    <span
                      key={deg}
                      className="star-bar-spark"
                      style={{ "--angle": `${deg}deg`, animationDelay: `${i * 18}ms` }}
                    />
                  ))}
                </>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
