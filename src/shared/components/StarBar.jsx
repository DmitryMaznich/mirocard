import { useRef, useEffect, useState } from "react";
import { computeStreakProgress } from "@/features/session/useStarProgress";

const STAR_COUNT = 5;

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
    const t = setTimeout(() => setAnimState({ gainIdx: null, loseIdx: null }), 500);
    return () => clearTimeout(t);
  }, [litStars]);

  if (!available) return null;

  const { gainIdx, loseIdx } = animState;

  return (
    <div className={`star-bar-zone ${className}`}>
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
                <span className="star-bar-star star-bar-star--fly">★</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
