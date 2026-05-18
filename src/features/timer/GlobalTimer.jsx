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

  let pillContent, pillState;
  if (isRunning) {
    pillContent = formatTime(timeLeft);
    pillState = "running";
  } else if (configMinutes > 0) {
    pillContent = `${configMinutes} мин`;
    pillState = "set";
  } else {
    pillContent = formatTime(sessionSeconds);
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
        {pillContent}
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
