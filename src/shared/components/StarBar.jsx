import { useRef, useEffect, useState } from "react";
import { useStarProgress } from "@/features/session/useStarProgress";

const STAR_COUNT = 5;

export default function StarBar({ className = "", correctCount, incorrectCount = 0, total, rewardThreshold, available }) {
  const { litStars, videoUnlocked } = useStarProgress({ correctCount, incorrectCount, total, rewardThreshold, available });

  const prevLitRef      = useRef(litStars);
  const prevUnlockedRef = useRef(videoUnlocked);
  const [animState, setAnimState] = useState({ gainIdx: null, loseIdx: null });
  const [ytAnim, setYtAnim]       = useState(null);

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

  useEffect(() => {
    const prev = prevUnlockedRef.current;
    prevUnlockedRef.current = videoUnlocked;
    if (videoUnlocked === prev) return;
    setYtAnim(videoUnlocked ? "unlock" : "lock");
    const t = setTimeout(() => setYtAnim(null), 700);
    return () => clearTimeout(t);
  }, [videoUnlocked]);

  if (!available) return null;

  const { gainIdx, loseIdx } = animState;

  return (
    <div className={`star-bar-zone ${className}`}>
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
      <div
        className={[
          "star-bar-yt",
          videoUnlocked ? "star-bar-yt--unlocked" : "star-bar-yt--locked",
          ytAnim ? `star-bar-yt--anim-${ytAnim}` : "",
          videoUnlocked && !ytAnim ? "star-bar-yt--pulse" : "",
        ].filter(Boolean).join(" ")}
      >
        <svg viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="YouTube">
          <rect width="34" height="24" rx="6" fill="#FF0000" />
          <polygon points="13,6 25,12 13,18" fill="white" />
        </svg>
      </div>
    </div>
  );
}
