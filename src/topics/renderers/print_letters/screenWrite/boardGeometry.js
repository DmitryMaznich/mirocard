import { useCallback, useRef } from "react";

// Helpers of the board shared by «Пишу на экране» and «Почини букву» (the drawing itself is board.jsx):
// a quiet tone, the letter's width, the board's viewBox around the letter.

export function useTone(enabled) {
  const ctxRef = useRef(null);
  return useCallback((freqs, dur = 0.09) => {
    if (!enabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = ctxRef.current ?? (ctxRef.current = new Ctx());
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + i * 0.09;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
      });
    } catch { /* no audio — silent */ }
  }, [enabled]);
}

export function glyphWidth(card) {
  return Number(String(card.viewBox ?? "0 0 50 100").split(/\s+/)[2]) || 50;
}

// The board is the ordinary notebook grid edge to edge (owner, 2026-11-04: «мы же можем спокойно
// использовать обычную клетку»): a letter is 2 cells tall, a regular one 1 cell wide, a wide one 1½
// (screenGlyph), standing on cell lines. The viewBox grows to the board's proportions around the
// letter (a cell of margin on every side, room for Ё's dots and Д's legs, and one more cell below for
// the navigation buttons that lie over the grid at the bottom).
export const CELL = 50;
export function boardBox(card, size) {
  const w = glyphWidth(card);
  const ar = size?.w > 0 && size?.h > 0 ? size.w / size.h : 1;
  // upright screens are narrow: the letter goes two cells lower, clear of the sample card in the corner
  const need = ar < 1
    ? { x0: -CELL, y0: -2.5 * CELL, w: Math.ceil(w / CELL) * CELL + 2 * CELL, h: 6.5 * CELL }
    : { x0: -CELL, y0: -1.5 * CELL, w: Math.ceil(w / CELL) * CELL + 2 * CELL, h: 5.5 * CELL };
  let bw = need.w, bh = need.h;
  if (ar > bw / bh) bw = bh * ar; else bh = bw / ar;
  return { x0: need.x0 - (bw - need.w) / 2, y0: need.y0 - (bh - need.h) / 2, w: bw, h: bh };
}

