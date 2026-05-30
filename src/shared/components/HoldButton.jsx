import { useRef, useState, useEffect } from "react";

const TICK_MS       = 40;
const TAP_MAX_MS    = 400;   // shorter than this = counts as tap
const TAP_WINDOW_MS = 2500;  // taps must come within this window
const REQUIRED_TAPS = 3;

export default function HoldButton({ onAction, children, className = "", holdMs = 3000, style }) {
  const [tapCount,  setTapCount]  = useState(0);
  const [phase,     setPhase]     = useState("tap"); // "tap" | "hold"
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
    // give a short window to re-press without resetting tap count
    scheduleReset();
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pressStartRef.current = Date.now();
    if (tapCountRef.current >= REQUIRED_TAPS) {
      startHold();
    }
  }

  function onPointerUp() {
    const duration = Date.now() - (pressStartRef.current ?? Date.now());

    if (tapCountRef.current >= REQUIRED_TAPS) {
      cancelHold();
      return;
    }

    if (duration < TAP_MAX_MS) {
      tapCountRef.current += 1;
      setTapCount(tapCountRef.current);
      if (tapCountRef.current >= REQUIRED_TAPS) {
        setPhase("hold");
      }
      scheduleReset();
    } else {
      // slow press during tap phase — treat as misfire, reset
      resetAll();
    }
  }

  function onPointerLeave() {
    if (tapCountRef.current >= REQUIRED_TAPS && intervalRef.current) {
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
      {tapCount > 0 && tapCount < REQUIRED_TAPS && (
        <span className="hold-btn-taps">
          {"●".repeat(tapCount)}{"○".repeat(REQUIRED_TAPS - tapCount)}
        </span>
      )}
    </button>
  );
}
