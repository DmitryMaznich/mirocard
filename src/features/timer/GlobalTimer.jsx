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
  const clockRef = useRef(null);
  const tabRef = useRef(null);
  const swipeRef = useRef(null);

  let tabText, tabState;
  if (isRunning) {
    tabText = formatTime(timeLeft);
    tabState = "running";
  } else if (configMinutes > 0) {
    tabText = `${configMinutes} мин`;
    tabState = "set";
  } else if (sessionSeconds > 0) {
    tabText = formatTime(sessionSeconds);
    tabState = "session";
  } else {
    tabText = null;
    tabState = "idle";
  }

  // Close on tap outside clock (but not on the tab itself)
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e) {
      if (
        clockRef.current && !clockRef.current.contains(e.target) &&
        tabRef.current && !tabRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [isOpen, setIsOpen]);

  // Swipe up on clock → close
  function handleClockPointerDown(e) {
    swipeRef.current = { y: e.clientY };
  }
  function handleClockPointerUp(e) {
    if (!swipeRef.current) return;
    const dy = e.clientY - swipeRef.current.y;
    swipeRef.current = null;
    if (dy < -40) setIsOpen(false);
  }

  return (
    <>
      <button
        ref={tabRef}
        className={`global-timer-tab global-timer-tab--${tabState}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Таймер"
      >
        <span className="global-timer-tab__icon">⏱</span>
        {tabText && <span className="global-timer-tab__text">{tabText}</span>}
        <span className="global-timer-tab__chevron">{isOpen ? "▲" : "▼"}</span>
      </button>

      <div
        ref={clockRef}
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
