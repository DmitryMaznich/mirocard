import { useEffect, useRef } from "react";
import { useTimer } from "./TimerContext";
import AnalogTimer from "./AnalogTimer";

function pad(n) { return String(n).padStart(2, "0"); }

export default function GlobalTimer({ rewardVideos = [] }) {
  const { isOpen, setIsOpen, timeLeft, isRunning, configMinutes, sessionSeconds } = useTimer();
  const clockRef = useRef(null);
  const tabRef = useRef(null);
  const swipeRef = useRef(null);

  let tabState, tabMM, tabSS;
  if (isRunning) {
    tabState = "running";
    tabMM = pad(Math.floor(timeLeft / 60));
    tabSS = pad(timeLeft % 60);
  } else if (configMinutes > 0) {
    tabState = "set";
    tabMM = pad(configMinutes);
    tabSS = "00";
  } else if (sessionSeconds > 0) {
    tabState = "session";
    tabMM = pad(Math.floor(sessionSeconds / 60));
    tabSS = pad(sessionSeconds % 60);
  } else {
    tabState = "idle";
    tabMM = null;
    tabSS = null;
  }

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
        {tabMM !== null ? (
          <span className="global-timer-tab__time">
            <span className="global-timer-tab__mm">{tabMM}</span>
            <span className="global-timer-tab__sep">·</span>
            <span className="global-timer-tab__ss">{tabSS}</span>
          </span>
        ) : (
          <span className="global-timer-tab__icon">⏱</span>
        )}
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
