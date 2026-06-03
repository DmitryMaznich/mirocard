import { useRef, useState, useEffect } from "react";

const TICK_MS       = 40;
const TAP_MAX_MS    = 400;
const TAP_WINDOW_MS = 2500;
const REQUIRED_TAPS = 3;

export default function HoldButton({ onAction, children, className = "", holdMs = 3000, style, skipTaps = false }) {
  const requiredTaps = skipTaps ? 0 : REQUIRED_TAPS;

  const [tapCount,  setTapCount]  = useState(0);
  const [phase,     setPhase]     = useState("tap");
  const [progress,  setProgress]  = useState(0);

  const intervalRef   = useRef(null);
  const resetTimerRef = useRef(null);
  const pressStartRef = useRef(null);
  const tapCountRef   = useRef(0);

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    clearTimeout(resetTimerRef.current);
  }, []);

  function resetAll() {
    clearInterval(intervalRef.current);
    clearTimeout(resetTimerRef.current);
    intervalRef.current = null;
    tapCountRef.current = 0;
    setTapCount(0);
    setProgress(0);
    setPhase("tap");
  }

  function scheduleReset() {
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(resetAll, TAP_WINDOW_MS);
  }

  function startHold() {
    if (intervalRef.current) return;
    clearTimeout(resetTimerRef.current);
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / holdMs) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        resetAll();
        onAction();
      }
    }, TICK_MS);
  }

  function cancelHold() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
    scheduleReset();
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pressStartRef.current = Date.now();
    if (tapCountRef.current >= requiredTaps) {
      startHold();
    }
  }

  function onPointerUp() {
    const duration = Date.now() - (pressStartRef.current ?? Date.now());

    if (tapCountRef.current >= requiredTaps) {
      cancelHold();
      return;
    }

    if (duration < TAP_MAX_MS) {
      tapCountRef.current += 1;
      setTapCount(tapCountRef.current);
      if (tapCountRef.current >= requiredTaps) {
        setPhase("hold");
      }
      scheduleReset();
    } else {
      resetAll();
    }
  }

  function onPointerLeave() {
    if (tapCountRef.current >= requiredTaps && intervalRef.current) {
      cancelHold();
    }
  }

  return (
    <button
      className={`hold-btn ${className}`}
      style={{ "--hold-p": progress, ...style }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {!skipTaps && tapCount > 0 && tapCount < REQUIRED_TAPS && (
        <span className="hold-btn-taps">
          {"●".repeat(tapCount)}{"○".repeat(REQUIRED_TAPS - tapCount)}
        </span>
      )}
    </button>
  );
}
