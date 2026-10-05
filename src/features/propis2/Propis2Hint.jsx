import { useEffect, useRef, useState } from "react";

// The name of an icon-only control. A mouse gets the browser's own `title` tooltip; on a touch screen (no hover) a
// press-and-hold shows the name in a small bubble for a moment, and the press that showed it does not click the button.
const HOLD_MS = 450;
const SHOW_MS = 1800;

export function useHint(label, place = "below") {
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState(null);
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
        // fixed to the screen (the tool strips scroll and clip their children); kept on the screen at the edges
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (place === "right") setPos({ left: rect.right + 6, top: rect.top + rect.height / 2, transform: "translateY(-50%)" });
        else {
          const above = rect.bottom > vh * 0.6;
          const vertical = above ? { bottom: vh - rect.top + 6 } : { top: rect.bottom + 6 };
          const cx = rect.left + rect.width / 2;
          if (rect.left < 90) setPos({ ...vertical, left: Math.max(6, rect.left) });
          else if (vw - rect.right < 90) setPos({ ...vertical, right: Math.max(6, vw - rect.right) });
          else setPos({ ...vertical, left: cx, transform: "translateX(-50%)" });
        }
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
  const tip = shown && pos ? <span className="p2-tip" role="tooltip" style={pos}>{label}</span> : null;
  return { bind, tip };
}
