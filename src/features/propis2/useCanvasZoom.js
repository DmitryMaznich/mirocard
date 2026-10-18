import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// The zoom of the constructor's canvas (owner, 2026-10-18: «to see what comes out right while editing, the page over the whole
// room for it, even if only a part shows»). `z` is the page's width over its fitted width (1 = «Вписать», the whole page);
// «По ширине» is the page as wide as the canvas. The page is only drawn wider (a vector page: nothing is redrawn), the canvas
// scrolls; taps keep finding their rows (the editor reads the page's place on screen). Remembered on this device.
const KEY = "propis2:canvasZoom";
const STEP = 1.25;
const MAX_OVER_WIDTH = 2.5; // the most: 2.5 times the canvas width (handwriting shows nothing more past it)

function readPref() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && (v.mode === "fit" || v.mode === "width" || (v.mode === "z" && Number.isFinite(v.z)))) return v;
  } catch { /* none kept */ }
  return { mode: "fit" };
}
const writePref = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* not kept */ } };

// `fitW`: the page's fitted width, `widthW`: the canvas width (both px, 0 until measured).
export function useCanvasZoom({ colRef, boxRef, fitW, widthW }) {
  const [pref, setPrefRaw] = useState(readPref);
  const widthZ = fitW > 0 && widthW > 0 ? Math.max(1, widthW / fitW) : 1;
  const maxZ = widthZ * MAX_OVER_WIDTH;
  const z = pref.mode === "fit" ? 1 : pref.mode === "width" ? widthZ : Math.min(maxZ, Math.max(1, pref.z));
  const anchor = useRef(null);

  // keep the point under `at` (client coords; none: the middle of the canvas) where it is while the page grows or shrinks
  const setPref = useCallback((next, at) => {
    const col = colRef.current;
    const box = boxRef.current;
    if (col && box) {
      const c = col.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const x = at?.x ?? c.left + c.width / 2;
      const y = at?.y ?? c.top + c.height / 2;
      anchor.current = { x, y, fx: b.width ? (x - b.left) / b.width : 0.5, fy: b.height ? (y - b.top) / b.height : 0.5 };
    }
    setPrefRaw(next);
    writePref(next);
  }, [colRef, boxRef]);

  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    const col = colRef.current;
    const box = boxRef.current;
    if (!a || !col || !box) return;
    const b = box.getBoundingClientRect();
    col.scrollLeft += b.left + a.fx * b.width - a.x;
    col.scrollTop += b.top + a.fy * b.height - a.y;
  }, [z, colRef, boxRef]);

  const toZ = (nz, at) => {
    const v = Math.min(maxZ, Math.max(1, nz));
    if (Math.abs(v - 1) < 0.01) setPref({ mode: "fit" }, at);
    else if (Math.abs(v - widthZ) < 0.01) setPref({ mode: "width" }, at);
    else setPref({ mode: "z", z: v }, at);
  };
  const zoomIn = () => toZ(z * STEP);
  const zoomOut = () => toZ(z / STEP);
  const fit = () => setPref({ mode: "fit" });
  const toWidth = () => setPref({ mode: "width" });

  // a computer: Ctrl + wheel (a touchpad's pinch comes as that too) zooms around the pointer
  const live = useRef({ z, toZ });
  live.current = { z, toZ };
  useEffect(() => {
    const col = colRef.current;
    if (!col) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const { z: cur, toZ: go } = live.current;
      go(cur * Math.exp(-e.deltaY * 0.0025), { x: e.clientX, y: e.clientY });
    };
    col.addEventListener("wheel", onWheel, { passive: false });
    return () => col.removeEventListener("wheel", onWheel);
  }, [colRef]);

  return { z, widthZ, maxZ, zoomIn, zoomOut, fit, toWidth, canWidth: widthZ > 1.02 };
}
