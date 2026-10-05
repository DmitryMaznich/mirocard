import { useEffect, useState } from "react";

// While the on-screen keyboard is open the editor follows the VISIBLE part of the screen (the visual viewport), so its bottom
// edge, the text field, always sits right above the keyboard, as in any messenger. iOS keeps the layout viewport as it was
// and scrolls it (offsetTop > 0) to reveal the focused field, so the keyboard is "open" when the visible height is smaller than
// the window, not when the visible area stopped at the window's bottom. Chrome on Android resizes the window itself: nothing to do.
const KEYBOARD_MIN_PX = 90;

export function useKeyboardInset(active = true) {
  const [state, setState] = useState({ open: false, top: 0, height: 0 });

  useEffect(() => {
    if (!active || typeof window === "undefined") return undefined;
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const read = () => {
      const open = window.innerHeight - vv.height > KEYBOARD_MIN_PX;
      const next = open ? { open: true, top: Math.round(vv.offsetTop), height: Math.round(vv.height) } : { open: false, top: 0, height: 0 };
      setState((prev) => (prev.open === next.open && prev.top === next.top && prev.height === next.height ? prev : next));
    };
    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => { vv.removeEventListener("resize", read); vv.removeEventListener("scroll", read); };
  }, [active]);

  return state;
}
