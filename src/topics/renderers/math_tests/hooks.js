import { useEffect, useState } from "react";

// Phones and tablets held upright get the phone layout (sheet on the whole width, the block panel
// docked at the bottom) — the same breakpoint as «Печатные буквы».
export const NARROW_QUERY = "(max-width: 760px), (orientation: portrait) and (max-width: 1100px)";

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

// px per mm so that the sheet fits the box: by width, and by height too when `fitHeight`
// (a whole page on a computer screen); never above `max`.
export function useFitScale(ref, wMm, hMm, { fitHeight = false, pad = 32, max = 96 / 25.4 } = {}) {
  const [scale, setScale] = useState(max * 0.6);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      const byW = (el.clientWidth - pad) / wMm;
      const byH = fitHeight ? (el.clientHeight - pad) / hMm : Infinity;
      setScale(Math.max(0.6, Math.min(max, byW, byH)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, wMm, hMm, fitHeight, pad, max]);
  return scale;
}
