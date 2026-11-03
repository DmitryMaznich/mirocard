import { useEffect, useState } from "react";

export const NARROW_QUERY = "(max-width: 760px)";
const PX_PER_MM = 96 / 25.4;
const CANVAS_PAD_PX = 32;

export function useMediaQuery(query) {
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [query]);
  return match;
}

// Shrinks the real-size sheet to the canvas width when the canvas is
// narrower than the paper (phones, small windows); never enlarges it.
export function useFitZoom(ref, sheetWidthMm) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      const avail = el.clientWidth - CANVAS_PAD_PX;
      setZoom(Math.min(1, Math.max(0.2, avail / (sheetWidthMm * PX_PER_MM))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, sheetWidthMm]);
  return zoom;
}
