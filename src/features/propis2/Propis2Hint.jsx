import { useEffect, useRef, useState } from "react";

// The name of an icon-only control. A mouse gets the browser's own `title` tooltip; on a touch screen (no hover) a
// press-and-hold shows the name in a small bubble for a moment, and the press that showed it does not click the button.
const HOLD_MS = 450;
const SHOW_MS = 1800;

export function useHint(label) {
  const [shown, setShown] = useState(false);
  const [align, setAlign] = useState("center");
  const holdTimer = useRef(null);
  const hideTimer = useRef(null);
  const suppress = useRef(false);

  useEffect(() => () => { clearTimeout(holdTimer.current); clearTimeout(hideTimer.current); }, []);

  const cancelHold = () => clearTimeout(holdTimer.current);
  const bind = {
    title: label,
    onPointerDown: (e) => {
      if (e.pointerType === "mouse") return;
      suppress.current = false;
      clearTimeout(holdTimer.current);
      const rect = e.currentTarget.getBoundingClientRect();
      holdTimer.current = setTimeout(() => {
        suppress.current = true;
        // keep the bubble on the screen: a button at an edge gets it aligned to that edge
        setAlign(rect.left < 90 ? "start" : window.innerWidth - rect.right < 90 ? "end" : "center");
        setShown(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShown(false), SHOW_MS);
      }, HOLD_MS);
    },
    onPointerUp: cancelHold,
    onPointerLeave: cancelHold,
    onPointerCancel: cancelHold,
    onContextMenu: (e) => { if (suppress.current) e.preventDefault(); },
    onClickCapture: (e) => {
      if (suppress.current) { suppress.current = false; e.stopPropagation(); e.preventDefault(); }
    },
  };
  const tip = shown ? <span className={`p2-tip p2-tip--${align}`} role="tooltip">{label}</span> : null;
  return { bind, tip };
}
