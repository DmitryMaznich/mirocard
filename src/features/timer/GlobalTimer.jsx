import { useEffect, useRef } from "react";
import { useTimer } from "./TimerContext";
import AnalogTimer from "./AnalogTimer";
import { getMinuteLabel } from "./timerFormat";

export default function GlobalTimer({ rewardVideos = [] }) {
  const { isOpen, setIsOpen, isRunning, timeLeft, activeLabel, timerSuggested, acknowledgeTimerSuggestion } = useTimer();
  const clockRef = useRef(null);
  const tabRef = useRef(null);
  const swipeRef = useRef(null);

  const tabState = isRunning ? "running" : (timerSuggested ? "suggested" : "idle");

  let runningTimeText = null;
  if (isRunning) {
    const remainingSeconds = Math.max(0, Math.ceil(timeLeft));
    runningTimeText = remainingSeconds > 0 && remainingSeconds < 60
      ? "меньше минуты"
      : `${Math.ceil(remainingSeconds / 60)} ${getMinuteLabel(Math.ceil(remainingSeconds / 60))}`;
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

  function handleTabClick() {
    setIsOpen((v) => {
      const next = !v;
      if (next) acknowledgeTimerSuggestion();
      return next;
    });
  }

  return (
    <>
      <button
        ref={tabRef}
        className={`global-timer-tab global-timer-tab--${tabState}`}
        onClick={handleTabClick}
        aria-label="Таймер"
      >
        {isRunning ? (
          <>
            <span className="global-timer-tab__running-label">{activeLabel}</span>
            <span className="global-timer-tab__running-time">{runningTimeText}</span>
          </>
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
