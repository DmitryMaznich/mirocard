import { useLayoutEffect, useRef, useState } from "react";

// Local copy of propis2's generic popup-positioning hook (src/features/propis2/usePopupPos.js) —
// pure UI plumbing, no propis2 content/methodology, so it's duplicated here rather than imported
// cross-topic (print_letters has no "features" folder of its own and shouldn't reach into
// propis2's). A popup opened from a toolbar button is fixed to the screen under that button so a
// scrolling ancestor can't clip it; it closes if the button itself moves (the toolbar scrolled).
export function usePopupPos(open, anchorRef, width, onClose) {
  const [style, setStyle] = useState(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) { setStyle((s) => (s === null ? s : null)); return undefined; }
    const rect = anchorRef.current.getBoundingClientRect();
    setStyle({ position: "fixed", top: rect.bottom + 6, left: `max(8px, min(${rect.left}px, calc(100vw - ${width + 8}px)))` });
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
