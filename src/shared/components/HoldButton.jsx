import { useRef, useState, useEffect } from "react";

const TICK_MS = 40;

export default function HoldButton({ onAction, children, className = "", holdMs = 3000, style }) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);
  const startRef    = useRef(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  function start() {
    if (intervalRef.current) return;
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - startRef.current) / holdMs) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setProgress(0);
        onAction();
      }
    }, TICK_MS);
  }

  function cancel() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  }

  return (
    <button
      className={`hold-btn ${className}`}
      style={{ "--hold-p": progress, ...style }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
