import { useRef, useEffect, useState } from "react";
import { computeStreakProgress } from "@/features/session/useStarProgress";

const STAR_COUNT = 5;
const BURN_MS = 750;
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export default function StarBar({ className = "", streakCount = 0, available, answersPerStar = 1 }) {
  const { litStars } = computeStreakProgress({ streakCount, available, answersPerStar });

  const prevLitRef = useRef(litStars);
  const [animState, setAnimState] = useState({ gainIdx: null, loseIdx: null });

  useEffect(() => {
    const prev = prevLitRef.current;
    prevLitRef.current = litStars;
    if (litStars === prev) return;
    if (litStars > prev) {
      setAnimState({ gainIdx: litStars - 1, loseIdx: null });
      const t = setTimeout(() => setAnimState({ gainIdx: null, loseIdx: null }), 500);
      return () => clearTimeout(t);
    }
    setAnimState({ gainIdx: null, loseIdx: prev - 1 });
    const t = setTimeout(() => setAnimState({ gainIdx: null, loseIdx: null }), BURN_MS);
    return () => clearTimeout(t);
  }, [litStars]);

  if (!available) return null;

  const { gainIdx, loseIdx } = animState;
  const isBurning = loseIdx !== null;

  return (
    <div className={`star-bar-zone ${isBurning ? "star-bar-zone--shake" : ""} ${className}`}>
      {answersPerStar > 1 && (
        <span className="star-bar-multiplier">×{answersPerStar}</span>
      )}
      <div className="star-bar-stars">
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const isLit  = i < litStars;
          const isGain = i === gainIdx;
          const isLose = i === loseIdx;
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
