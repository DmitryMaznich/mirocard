import { useEffect, useState } from "react";

// How much of the screen the on-screen keyboard covers, and how much is left visible above it. The keyboard is meant to
// OVERLAY the page (the constructor lifts only the text field above it), so while the editor is open the viewport meta asks
// browsers that resize the page for the keyboard (Chrome on Android) to overlay instead; iOS Safari overlays anyway.
const KEYBOARD_MIN_PX = 90;

export function useKeyboardInset(active = true) {
  const [state, setState] = useState({ kb: 0, vvh: 0 });

  useEffect(() => {
    if (!active || typeof window === "undefined") return undefined;
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute("content");
    if (meta && original && !original.includes("interactive-widget")) meta.setAttribute("content", `${original}, interactive-widget=overlays-content`);
    const vv = window.visualViewport;
    if (!vv) return () => { if (meta && original) meta.setAttribute("content", original); };
    const read = () => {
      const covered = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      const open = covered > KEYBOARD_MIN_PX;
      setState((prev) => (open ? (prev.kb === covered && prev.vvh === Math.round(vv.height) ? prev : { kb: covered, vvh: Math.round(vv.height) }) : (prev.kb === 0 ? prev : { kb: 0, vvh: 0 })));
      // iOS scrolls the page to show the focused field: keep the editor where it is, the field alone moves
      if (open && vv.offsetTop > 0) window.scrollTo(0, 0);
    };
    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
      if (meta && original) meta.setAttribute("content", original);
    };
  }, [active]);

  return state;
}
