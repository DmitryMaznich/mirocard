import { useLayoutEffect, useRef, useState } from "react";

// A popup opened from a button inside a horizontally scrolling tool strip must not live inside the strip (it would be
// clipped by it), so it is fixed to the screen under the button: `top`/`left` come from the button's rect, `left` is kept
// on the screen for a popup of `width` px. It closes when the button really moves (the strip is scrolled).
export function usePopupPos(open, anchorRef, width, onClose) {
  const [style, setStyle] = useState(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }); // always the latest, without re-running the main effect on every render
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) { setStyle((s) => (s === null ? s : null)); return undefined; }
    const rect = anchorRef.current.getBoundingClientRect();
    setStyle({ position: "fixed", top: rect.bottom + 6, left: `max(8px, min(${rect.left}px, calc(100vw - ${width + 8}px)))` });
    // not a scroll-snap settle, a page scroll from a focused input, or the popup's own scroll: only a moved button
    const onScroll = (e) => {
      if (!e?.target || e.target === document || !e.target.contains?.(anchorRef.current)) return;
      const now = anchorRef.current.getBoundingClientRect();
      if (Math.abs(now.left - rect.left) > 8 || Math.abs(now.top - rect.top) > 8) closeRef.current();
    };
    const onResize = () => closeRef.current();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onResize); };
  }, [open, anchorRef, width]);
  return style;
}
