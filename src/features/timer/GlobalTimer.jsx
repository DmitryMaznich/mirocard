import { useEffect, useRef } from "react";
import { useTimer } from "./TimerContext";
import AnalogTimer from "./AnalogTimer";

function formatTabTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GlobalTimer({ rewardVideos = [] }) {
  const { isOpen, setIsOpen, timeLeft, isRunning } = useTimer();
  const containerRef = useRef(null);
  const swipeRef = useRef(null);

  const showCountdown = timeLeft > 0;
  const tabState = isRunning ? "running" : showCountdown ? "paused" : "idle";

  // Close on tap outside the clock+tab
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
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

      <button
        className={`global-timer__tab global-timer__tab--${tabState}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Таймер"
      >
        {showCountdown ? (
          <span className="global-timer__tab-time">{formatTabTime(timeLeft)}</span>
        ) : (
          <span className="global-timer__tab-icon">⏱</span>
        )}
      </button>
    </div>
  );
}
