import { useEffect, useRef } from "react";
import { useTimer } from "./TimerContext";
import AnalogTimer from "./AnalogTimer";

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GlobalTimer({ rewardVideos = [] }) {
  const { isOpen, setIsOpen, timeLeft, isRunning, configMinutes, sessionSeconds } = useTimer();
  const containerRef = useRef(null);
  const pillRef = useRef(null);
  const swipeRef = useRef(null);

  let pillText, pillState;
  if (isRunning) {
    pillText = formatTime(timeLeft);
    pillState = "running";
  } else if (configMinutes > 0) {
    pillText = `${configMinutes} мин`;
    pillState = "set";
  } else if (sessionSeconds > 0) {
    pillText = formatTime(sessionSeconds);
    pillState = "session";
  } else {
    pillText = null;
    pillState = "idle";
  }

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e) {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        pillRef.current && !pillRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [isOpen, setIsOpen]);

  function handleClockPointerDown(e) {
    swipeRef.current = { x: e.clientX };
  }

  function handleClockPointerUp(e) {
    if (!swipeRef.current) return;
    const dx = e.clientX - swipeRef.current.x;
    swipeRef.current = null;
    if (dx < -40) setIsOpen(false);
  }

  return (
    <>
      <button
        ref={pillRef}
        className={`global-timer-pill global-timer-pill--${pillState}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Таймер"
      >
        <span className="global-timer-pill__icon">⏱</span>
        {pillText && <span className="global-timer-pill__text">{pillText}</span>}
      </button>

      <div
        ref={containerRef}
        className={`global-timer${isOpen ? " global-timer--open" : ""}`}
      >
        <div
          className="global-timer__clock"
          onPointerDown={handleClockPointerDown}
          onPointerUp={handleClockPointerUp}
        >
          <AnalogTimer rewardVideos={rewardVideos} clockOnly />
        </div>
      </div>
    </>
  );
}
