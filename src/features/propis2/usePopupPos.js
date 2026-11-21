import { useLayoutEffect, useRef, useState } from "react";

// A popup opened from a button inside a horizontally scrolling tool strip must not live inside the strip (it would be
// clipped by it), so it is fixed to the screen under the button: `top`/`left` come from the button's rect, `left` is kept
// on the screen for a popup of `width` px. It closes when the button really moves (the strip is scrolled); a change of the screen's size
// (the keyboard) moves it back under the button instead.
export function usePopupPos(open, anchorRef, width, onClose) {
  const [style, setStyle] = useState(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }); // always the latest, without re-running the main effect on every render
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) { setStyle((s) => (s === null ? s : null)); return undefined; }
    let rect = anchorRef.current.getBoundingClientRect();
    const place = () => {
      if (!anchorRef.current) return;
      rect = anchorRef.current.getBoundingClientRect();
      setStyle({ position: "fixed", top: rect.bottom + 6, left: `max(8px, min(${rect.left}px, calc(100vw - ${width + 8}px)))` });
    };
    place();
    // not a scroll-snap settle, a page scroll from a focused input, or the popup's own scroll: only a moved button
    // …and only one the user moved: a finger or a wheel since the popup opened. The strip also shifts by itself as the popup goes into it
    // (on a tablet it scrolled 49 px sideways 10 ms after «Элемент» / «Штрихи» opened, and the popup closed at once — owner, 2026-11-21:
    // «панели мигают»): then the popup follows its button
    let userMoved = false;
    const moved = () => { userMoved = true; };
    const onScroll = (e) => {
      if (!e?.target || e.target === document || !e.target.contains?.(anchorRef.current)) return;
      if (!userMoved) { place(); return; }
      const now = anchorRef.current.getBoundingClientRect();
      // the strip scrolled sideways: the button left its place — close; moved up or down (the screen scrolled for the keyboard): follow it
      if (Math.abs(now.left - rect.left) > 8) closeRef.current();
      else if (Math.abs(now.top - rect.top) > 1) place();
    };
    // the screen changing size — on a tablet the keyboard going away or coming up as the button is tapped (owner, 2026-11-21: «панели
    // мигают, быстро появляются и исчезают») — moves the popup back under its button; it used to close it
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    vv?.addEventListener("resize", place);
    window.addEventListener("touchmove", moved, { capture: true, passive: true });
    window.addEventListener("wheel", moved, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", place); vv?.removeEventListener("resize", place);
      window.removeEventListener("touchmove", moved, { capture: true }); window.removeEventListener("wheel", moved, { capture: true });
    };
  }, [open, anchorRef, width]);
  return style;
}
