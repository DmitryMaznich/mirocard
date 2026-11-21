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
    if (v && (v.mode === "fit" || v.mode === "width" || v.mode === "whole" || (v.mode === "z" && Number.isFinite(v.z)))) return v;
  } catch { /* none kept */ }
  return { mode: "fit" };
}
const writePref = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* not kept */ } };

// `fitW`: the page's fitted width, `widthW`: the canvas width, `wholeW`: the width at which the WHOLE page is in sight (px, 0 until
// measured). On a phone / portrait tablet the fitted page is as wide as the canvas and runs below it: «Лист целиком» (owner, 2026-11-21)
// shrinks it under 100 % until all of it shows; on a computer the fitted page is already whole.
export function useCanvasZoom({ colRef, boxRef, fitW, widthW, wholeW = 0 }) {
  const [pref, setPrefRaw] = useState(readPref);
  const widthZ = fitW > 0 && widthW > 0 ? Math.max(1, widthW / fitW) : 1;
  const wholeZ = fitW > 0 && wholeW > 0 ? Math.min(1, wholeW / fitW) : 1;
  const minZ = wholeZ;
  const maxZ = widthZ * MAX_OVER_WIDTH;
  const z = pref.mode === "fit" ? 1 : pref.mode === "width" ? widthZ : pref.mode === "whole" ? wholeZ : Math.min(maxZ, Math.max(minZ, pref.z));
  const anchor = useRef(null);

  // keep the point under `at` (client coords; none: the middle of the canvas) where it is while the page grows or shrinks
  const setPref = useCallback((next, at, keep = true) => {
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
    if (keep) writePref(next);
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

  const toZ = (nz, at, keep = true) => {
    const v = Math.min(maxZ, Math.max(minZ, nz));
    if (Math.abs(v - 1) < 0.01) setPref({ mode: "fit" }, at, keep);
    else if (Math.abs(v - widthZ) < 0.01) setPref({ mode: "width" }, at, keep);
    else if (minZ < 0.99 && Math.abs(v - minZ) < 0.01) setPref({ mode: "whole" }, at, keep);
    else setPref({ mode: "z", z: v }, at, keep);
  };
  const zoomIn = () => toZ(z * STEP);
  const zoomOut = () => toZ(z / STEP);
  const fit = () => setPref({ mode: "fit" });
  const toWidth = () => setPref({ mode: "width" });
  const toWhole = () => setPref({ mode: "whole" });

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

  // a phone / tablet: two fingers zoom around the point between them and move the page with them (owner, 2026-11-21: «зумирование
  // пальцами» as in the student view); one finger scrolls as ever. Applied once a frame; kept on the device when the fingers lift.
  useEffect(() => {
    const col = colRef.current;
    if (!col) return undefined;
    let pinch = null, frame = 0, pending = null;
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
    const apply = () => {
      frame = 0;
      if (!pending) return;
      const { nz, at, dx, dy } = pending;
      pending = null;
      col.scrollLeft -= dx;
      col.scrollTop -= dy;
      live.current.toZ(nz, at, false);
    };
    const onStart = (e) => {
      if (e.touches.length !== 2) return;
      const [a, b] = e.touches;
      pinch = { d: dist(a, b) || 1, z: live.current.z, last: mid(a, b) };
    };
    const onMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = e.touches;
      const m = mid(a, b);
      pending = { nz: pinch.z * (dist(a, b) / pinch.d), at: m, dx: (pending?.dx ?? 0) + m.x - pinch.last.x, dy: (pending?.dy ?? 0) + m.y - pinch.last.y };
      pinch.last = m;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onEnd = (e) => {
      if (!pinch || e.touches.length >= 2) return;
      pinch = null;
      if (frame) { cancelAnimationFrame(frame); apply(); }
      live.current.toZ(live.current.z); // kept on the device
    };
    col.addEventListener("touchstart", onStart, { passive: true });
    col.addEventListener("touchmove", onMove, { passive: false });
    col.addEventListener("touchend", onEnd);
    col.addEventListener("touchcancel", onEnd);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      col.removeEventListener("touchstart", onStart);
      col.removeEventListener("touchmove", onMove);
      col.removeEventListener("touchend", onEnd);
      col.removeEventListener("touchcancel", onEnd);
    };
  }, [colRef]);

  return { z, widthZ, wholeZ, minZ, maxZ, zoomIn, zoomOut, fit, toWidth, toWhole, canWidth: widthZ > 1.02, canWhole: wholeZ < 0.98 };
}
