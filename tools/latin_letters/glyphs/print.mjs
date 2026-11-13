// Print (manuscript) Latin glyphs, style "print" — family 1 in docs/latin-letters.md.
//
// Coordinates: the English four-line ruling with equal bands of 50 units (= one 5 mm notebook
// cell, so the same glyphs sit on the cell grid too):
//   y = 0   top line        (capitals, ascenders b d f h k l)
//   y = 50  x-line          (top of a c e m n o …)
//   y = 100 baseline
//   y = 150 descender line  (g j p q y)
// Each stroke's path runs in the writing direction (its first point is the start dot).
// Paths use only M, L and C, like tools/print_letters/topic.json, so print_letters' glyph
// renderer and on-screen tracing can draw them.
//
// Run: node tools/latin_letters/glyphs/print.mjs  → writes print.json next to this file.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { arc, line, dot, s, r2 } from "./geom.mjs";

// x-band: circle centre y=75, radius 25. "Ball and stick": round part + straight stick.
const BOWL_L = (cx = 25) => arc(cx, 75, 25, 25, -30, -390); // a d g q: start at 1 o'clock, back round
const lower = {
  a: [50, [s(BOWL_L(), "овал"), s(line([50, 50], [50, 100]), "палочка")]],
  b: [50, [s(line([0, 0], [0, 100]), "палочка"), s(arc(25, 75, 25, 25, 180, 540), "овал")]],
  c: [50, [s(arc(25, 75, 25, 25, -40, -320), "полуовал")]],
  d: [50, [s(BOWL_L(), "овал"), s(line([50, 0], [50, 100]), "палочка")]],
  e: [50, [s(`${line([0, 75], [50, 75])} ${arc(25, 75, 25, 25, 0, -320, { move: false })}`, "черта и полуовал")]],
  f: [45, [s(`${arc(35, 20, 15, 15, -30, -180)} L 20,100`, "крючок и палочка"), s(line([5, 50], [40, 50]), "черта")]],
  g: [50, [s(BOWL_L(), "овал"), s(`${line([50, 50], [50, 130])} ${arc(30, 130, 20, 20, 0, 160, { move: false })}`, "палочка с крючком")]],
  h: [50, [s(line([0, 0], [0, 100]), "палочка"), s(`${arc(25, 75, 25, 25, 180, 360)} L 50,100`, "горка")]],
  i: [10, [s(line([5, 50], [5, 100]), "палочка"), dot(5, 30)]],
  j: [35, [s(`${line([30, 50], [30, 130])} ${arc(15, 130, 15, 20, 0, 170, { move: false })}`, "палочка с крючком"), dot(30, 30)]],
  k: [40, [s(line([0, 0], [0, 100]), "палочка"), s(line([40, 50], [0, 75], [40, 100]), "уголок")]],
  l: [10, [s(line([5, 0], [5, 100]), "палочка")]],
  m: [70, [
    s(line([0, 50], [0, 100]), "палочка"),
    s(`${arc(17.5, 70, 17.5, 20, 180, 360)} L 35,100`, "горка"),
    s(`${arc(52.5, 70, 17.5, 20, 180, 360)} L 70,100`, "горка"),
  ]],
  n: [50, [s(line([0, 50], [0, 100]), "палочка"), s(`${arc(25, 75, 25, 25, 180, 360)} L 50,100`, "горка")]],
  o: [50, [s(arc(25, 75, 25, 25, -60, -420), "овал")]],
  p: [50, [s(line([0, 50], [0, 150]), "палочка"), s(arc(25, 75, 25, 25, 180, 540), "овал")]],
  q: [50, [s(BOWL_L(), "овал"), s(line([50, 50], [50, 150]), "палочка")]],
  r: [40, [s(line([0, 50], [0, 100]), "палочка"), s(arc(22, 72, 22, 22, 180, 305), "дужка")]],
  s: [45, [s("M 42,58 C 34,48 6,48 6,63 C 6,77 42,72 42,87 C 42,103 10,103 2,92", "змейка")]],
  t: [35, [s(line([15, 15], [15, 100]), "палочка"), s(line([0, 50], [35, 50]), "черта")]],
  u: [50, [s(`${line([0, 50], [0, 78])} ${arc(25, 78, 25, 22, 180, 0, { move: false })}`, "крючок"), s(line([50, 50], [50, 100]), "палочка")]],
  v: [50, [s(line([0, 50], [25, 100], [50, 50]), "уголок")]],
  w: [70, [s(line([0, 50], [17.5, 100], [35, 50], [52.5, 100], [70, 50]), "два уголка")]],
  x: [50, [s(line([0, 50], [50, 100]), "наклонная"), s(line([50, 50], [0, 100]), "наклонная")]],
  y: [50, [s(line([0, 50], [27.5, 100]), "наклонная"), s(line([50, 50], [5, 150]), "длинная наклонная")]],
  z: [50, [s(line([0, 50], [50, 50], [0, 100], [50, 100]), "зигзаг")]],
};

const upper = {
  A: [60, [s(line([30, 0], [0, 100]), "наклонная"), s(line([30, 0], [60, 100]), "наклонная"), s(line([12, 65], [48, 65]), "черта")]],
  B: [50, [
    s(line([0, 0], [0, 100]), "палочка"),
    s(`M 0,0 L 20,0 ${arc(20, 25, 22, 25, -90, 90, { move: false })} L 0,50`, "верхняя дуга"),
    s(`M 0,50 L 24,50 ${arc(24, 75, 26, 25, -90, 90, { move: false })} L 0,100`, "нижняя дуга"),
  ]],
  C: [80, [s(arc(40, 50, 40, 50, -40, -320), "полуовал")]],
  D: [60, [s(line([0, 0], [0, 100]), "палочка"), s(`M 0,0 L 10,0 ${arc(10, 50, 50, 50, -90, 90, { move: false })} L 0,100`, "дуга")]],
  E: [45, [s(line([0, 0], [0, 100]), "палочка"), s(line([0, 0], [45, 0]), "верхняя черта"), s(line([0, 50], [35, 50]), "средняя черта"), s(line([0, 100], [45, 100]), "нижняя черта")]],
  F: [45, [s(line([0, 0], [0, 100]), "палочка"), s(line([0, 0], [45, 0]), "верхняя черта"), s(line([0, 50], [35, 50]), "средняя черта")]],
  G: [80, [s(`${arc(40, 50, 40, 50, -40, -360)} L 45,50`, "полуовал и черта")]],
  H: [50, [s(line([0, 0], [0, 100]), "палочка"), s(line([50, 0], [50, 100]), "палочка"), s(line([0, 50], [50, 50]), "черта")]],
  I: [30, [s(line([15, 0], [15, 100]), "палочка"), s(line([0, 0], [30, 0]), "верхняя черта"), s(line([0, 100], [30, 100]), "нижняя черта")]],
  J: [45, [s(`${line([45, 0], [45, 75])} ${arc(22.5, 75, 22.5, 25, 0, 180, { move: false })}`, "палочка с крючком")]],
  K: [50, [s(line([0, 0], [0, 100]), "палочка"), s(line([50, 0], [0, 50], [50, 100]), "уголок")]],
  L: [45, [s(line([0, 0], [0, 100], [45, 100]), "уголок")]],
  M: [70, [s(line([0, 0], [0, 100]), "палочка"), s(line([0, 0], [35, 70], [70, 0], [70, 100]), "уголок и палочка")]],
  N: [55, [s(line([0, 0], [0, 100]), "палочка"), s(line([0, 0], [55, 100], [55, 0]), "наклонная и палочка")]],
  O: [80, [s(arc(40, 50, 40, 50, -90, -450), "овал")]],
  P: [45, [s(line([0, 0], [0, 100]), "палочка"), s(`M 0,0 L 20,0 ${arc(20, 27.5, 25, 27.5, -90, 90, { move: false })} L 0,55`, "дуга")]],
  Q: [80, [s(arc(40, 50, 40, 50, -90, -450), "овал"), s(line([50, 70], [80, 100]), "хвостик")]],
  R: [50, [s(line([0, 0], [0, 100]), "палочка"), s(`M 0,0 L 20,0 ${arc(20, 27.5, 25, 27.5, -90, 90, { move: false })} L 0,55`, "дуга"), s(line([20, 55], [50, 100]), "наклонная")]],
  S: [55, [s("M 52,14 C 42,-2 4,0 4,24 C 4,50 54,46 54,74 C 54,102 12,104 2,84", "змейка")]],
  T: [60, [s(line([30, 0], [30, 100]), "палочка"), s(line([0, 0], [60, 0]), "черта")]],
  U: [55, [s(`${line([0, 0], [0, 65])} ${arc(27.5, 65, 27.5, 35, 180, 0, { move: false })} L 55,0`, "дуга")]],
  V: [60, [s(line([0, 0], [30, 100], [60, 0]), "уголок")]],
  W: [80, [s(line([0, 0], [20, 100], [40, 0], [60, 100], [80, 0]), "два уголка")]],
  X: [55, [s(line([0, 0], [55, 100]), "наклонная"), s(line([55, 0], [0, 100]), "наклонная")]],
  Y: [56, [s(line([0, 0], [28, 50]), "наклонная"), s(line([56, 0], [28, 50]), "наклонная"), s(line([28, 50], [28, 100]), "палочка")]],
  Z: [55, [s(line([0, 0], [55, 0], [0, 100], [55, 100]), "зигзаг")]],
};

// Digits and signs, upright print (owner, 2026-11-08: the English styles must not borrow the Russian cursive ones): digits as tall as
// a capital (top line to baseline); + − = < > centred on the x band; . , ? ! on the baseline. Stroke order as the school print models:
// 1 with its flag first, 4 open, 5 down-and-round then its top bar.
const signs = {
  0: [44, [s(arc(22, 50, 22, 50, -90, -450), "овал")]],
  1: [20, [s(line([2, 16], [20, 0], [20, 100]), "флажок и палочка")]],
  2: [48, [s("M 4,24 C 4,8 16,0 26,0 C 38,0 46,10 46,24 C 46,42 28,58 2,100 L 48,100", "шейка и черта")]],
  3: [46, [s("M 6,12 C 14,0 42,0 42,24 C 42,40 30,48 20,48 C 34,48 46,58 46,74 C 46,92 32,100 22,100 C 12,100 4,94 2,88", "две дуги")]],
  4: [48, [s(line([34, 0], [2, 66], [48, 66]), "уголок"), s(line([36, 34], [36, 100]), "палочка")]],
  5: [48, [s("M 8,0 L 6,44 C 14,38 22,36 28,36 C 42,36 48,50 48,66 C 48,86 36,100 22,100 C 12,100 4,94 2,88", "палочка и дуга"), s(line([8, 0], [42, 0]), "черта")]],
  6: [48, [s("M 40,4 C 30,-2 6,4 4,40 C 2,76 10,100 26,100 C 40,100 48,88 48,72 C 48,56 38,46 26,46 C 14,46 6,56 4,66", "дуга и петля")]],
  7: [46, [s(line([2, 0], [46, 0], [16, 100]), "черта и наклонная")]],
  8: [48, [s("M 42,16 C 40,6 32,0 24,0 C 12,0 5,9 5,22 C 5,46 47,50 47,74 C 47,90 36,100 24,100 C 12,100 1,90 1,74 C 1,50 43,46 43,22 C 43,19 42.6,17.5 42,16", "восьмёрка")]],
  9: [46, [s("M 44,30 C 44,12 34,0 22,0 C 10,0 2,12 2,26 C 2,40 12,50 24,50 C 34,50 42,42 44,30 L 40,100", "петля и палочка")]],
  "+": [40, [s(line([0, 75], [40, 75]), "черта"), s(line([20, 55], [20, 95]), "палочка")]],
  "-": [30, [s(line([0, 75], [30, 75]), "черта")]],
  "=": [40, [s(line([0, 66], [40, 66]), "черта"), s(line([0, 84], [40, 84]), "черта")]],
  ">": [36, [s(line([0, 58], [36, 75], [0, 92]), "уголок")]],
  "<": [36, [s(line([36, 58], [0, 75], [36, 92]), "уголок")]],
  ".": [6, [dot(3, 97, 3)]],
  ",": [8, [s("M 5,94 C 7,98 7,104 1,111", "запятая")]],
  "?": [46, [s("M 4,18 C 6,4 18,0 26,0 C 38,0 46,10 46,22 C 46,36 26,42 26,64 L 26,74", "крючок"), dot(26, 96, 3)]],
  "!": [10, [s(line([5, 0], [5, 76]), "палочка"), dot(5, 96, 3)]],
  // 2026-11-10: the signs of the Nelson copymasters' sentences and texts (don't, I'm, «Ingredients:», “Just look at it growing!”)
  ":": [6, [dot(3, 58, 3), dot(3, 97, 3)]],
  ";": [8, [dot(5, 58, 3), s("M 5,94 C 7,98 7,104 1,111", "запятая")]],
  "'": [7, [s("M 4,0 C 6,4 6,10 1.5,17", "апостроф")]],
  "’": [7, [s("M 4,0 C 6,4 6,10 1.5,17", "апостроф")]],
  '"': [14, [s(line([3, 0], [3, 16]), "черта"), s(line([11, 0], [11, 16]), "черта")]],
  "“": [16, [s("M 6,0 C 2,5 2,11 4.5,17", "кавычка"), s("M 14,0 C 10,5 10,11 12.5,17", "кавычка")]],
  "”": [16, [s("M 4,0 C 6,4 6,10 1.5,17", "кавычка"), s("M 12,0 C 14,4 14,10 9.5,17", "кавычка")]],
  "(": [14, [s("M 13,0 C 1,30 1,94 13,124", "скобка")]],
  ")": [14, [s("M 1,0 C 13,30 13,94 1,124", "скобка")]],
};

// Č Š Ž č š ž (Slovenian, docs/propis2-sl.md): the letter, then the caron as its own last stroke — «strešico … napiše nazadnje»
// (Naša ulica 2). Small letters: between the top line and the x-line, where the Slovene school model has it; capitals: above the top line.
const caron = (cx, yTop, h = 13, w = 9) => s(line([cx - w, yTop], [cx, yTop + h], [cx + w, yTop]), "гачек");
for (const [base, ch] of [["c", "č"], ["s", "š"], ["z", "ž"]]) {
  const [w, strokes] = lower[base];
  lower[ch] = [w, [...strokes, caron(w / 2, 27)]];
  const [W, Strokes] = upper[base.toUpperCase()];
  upper[ch.toUpperCase()] = [W, [...Strokes, caron(W / 2, -23, 14, 10)]];
}

// Slovenian print, style "print_sl" (docs/propis2-sl.md): the same letters, but every small letter that the pen can write without
// lifting is ONE stroke, going back over the stick where needed («zapis črk z eno potezo», Naša ulica 2; ZRSS 2022: «N nima treh
// potez. Ima dve ali eno, n pa samo eno»), and the capitals A M N as the Slovene stroke-order chart («Za začetek», p. 54) has them:
// A — left leg UP to the apex, right leg down, bar; M and N in one stroke from the bottom left, up first.
// The oval of a one-stroke a d g starts and ends at 3 o'clock — on the stick's own line — so the pen goes up the stick from there and
// comes back down over the same line (from BOWL_L()'s 1 o'clock the way up showed as a tick outside the oval)
const BOWL_SL = arc(25, 75, 25, 25, 0, -360);
const BOWL_END = "L 50,50";
const slLower = {
  a: [50, [s(`${BOWL_SL} ${BOWL_END} L 50,100`, "овал и палочка")]],
  b: [50, [s(`M 0,0 L 0,100 L 0,75 ${arc(25, 75, 25, 25, 180, 540, { move: false })}`, "палочка и овал")]],
  d: [50, [s(`${BOWL_SL} L 50,0 L 50,100`, "овал и палочка")]],
  g: [50, [s(`${BOWL_SL} ${BOWL_END} L 50,130 ${arc(30, 130, 20, 20, 0, 160, { move: false })}`, "овал и палочка с крючком")]],
  h: [50, [s(`M 0,0 L 0,100 L 0,75 ${arc(25, 75, 25, 25, 180, 360, { move: false })} L 50,100`, "палочка и горка")]],
  m: [70, [s(`M 0,50 L 0,100 L 0,70 ${arc(17.5, 70, 17.5, 20, 180, 360, { move: false })} L 35,100 L 35,70 ${arc(52.5, 70, 17.5, 20, 180, 360, { move: false })} L 70,100`, "палочка и две горки")]],
  n: [50, [s(`M 0,50 L 0,100 L 0,75 ${arc(25, 75, 25, 25, 180, 360, { move: false })} L 50,100`, "палочка и горка")]],
  p: [50, [s(`M 0,50 L 0,150 L 0,75 ${arc(25, 75, 25, 25, 180, 540, { move: false })}`, "палочка и овал")]],
  r: [40, [s(`M 0,50 L 0,100 L 0,72 ${arc(22, 72, 22, 22, 180, 305, { move: false })}`, "палочка и дужка")]],
  u: [50, [s(`M 0,50 L 0,78 ${arc(25, 78, 25, 22, 180, 0, { move: false })} L 50,50 L 50,100`, "крючок и палочка")]],
};
const slUpper = {
  A: [60, [s(line([0, 100], [30, 0]), "наклонная"), s(line([30, 0], [60, 100]), "наклонная"), s(line([12, 65], [48, 65]), "черта")]],
  M: [70, [s(line([0, 100], [0, 0], [35, 70], [70, 0], [70, 100]), "палочки и уголок")]],
  N: [55, [s(line([0, 100], [0, 0], [55, 100], [55, 0]), "палочки и наклонная")]],
};

const glyphs = {};
for (const [set, kind] of [[upper, "upper"], [lower, "lower"], [signs, "sign"]]) {
  for (const [ch, [width, strokes]] of Object.entries(set)) glyphs[ch] = { case: kind, width, strokes };
}

const out = {
  style: "print",
  title: { ru: "Печатные", en: "Print" },
  ruling: { units: 50, lines: { top: 0, x: 50, base: 100, bottom: 150 } },
  glyphs,
};
const file = fileURLToPath(new URL("./print.json", import.meta.url));
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${Object.keys(glyphs).length} glyphs → ${file}`);

const slGlyphs = { ...glyphs };
for (const [set, kind] of [[slUpper, "upper"], [slLower, "lower"]]) {
  for (const [ch, [width, strokes]] of Object.entries(set)) slGlyphs[ch] = { case: kind, width, strokes };
}
// The letters a Slovene text borrows (owner, 2026-11-14: «заимствованные буквы x y q w и сразу хорватские đ ć» — foreign names and
// words, SP 2001: q w x y, ć đ, ä ö ü), outside the 25 of the alphabet (`alphabet.lower` keeps 25: cards and the cover alphabet stay
// Slovene) but written when typed. q w x y as the English print, q in one stroke like g; ć — c and the acute (a lift, last, like the
// caron), đ — d and a bar across its stick, ä ö ü — two dots, last.
const shiftX = (d, dx) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${r2(Number(x) + dx)},${y}`);
const acute = (cx, yTop, h = 15) => s(line([cx + 5, yTop], [cx - 5, yTop + h]), "черточка");
const dots2 = (cx, y, gap = 9) => [dot(cx - gap, y), dot(cx + gap, y)];
const slExtra = {
  lower: {
    q: [50, [s(`${BOWL_SL} ${BOWL_END} L 50,150`, "овал и палочка")]],
    "ć": [50, [...lower.c[1], acute(27, 24)]],
    "đ": [50, [...slLower.d[1], s(line([36, 22], [64, 22]), "черта")]],
    "ä": [50, [...slLower.a[1], ...dots2(25, 33)]],
    "ö": [50, [...lower.o[1], ...dots2(25, 33)]],
    "ü": [50, [...slLower.u[1], ...dots2(25, 33)]],
  },
  upper: {
    "Ć": [80, [...upper.C[1], acute(44, -25)]],
    "Đ": [70, [...upper.D[1].map((st) => ({ ...st, d: shiftX(st.d, 10) })), s(line([0, 50], [26, 50]), "черта")]],
    "Ä": [60, [...slUpper.A[1], ...dots2(30, -12, 10)]],
    "Ö": [80, [...upper.O[1], ...dots2(40, -12, 10)]],
    "Ü": [55, [...upper.U[1], ...dots2(27.5, -12, 10)]],
  },
};
for (const kind of ["lower", "upper"]) for (const [ch, [width, strokes]] of Object.entries(slExtra[kind])) slGlyphs[ch] = { case: kind, width, strokes };
const slFile = fileURLToPath(new URL("./print_sl.json", import.meta.url));
writeFileSync(slFile, JSON.stringify({ ...out, style: "print_sl", title: { ru: "Печатные (словенские)", sl: "Tiskane črke" }, glyphs: slGlyphs }, null, 1) + "\n");
console.log(`wrote ${Object.keys(slGlyphs).length} glyphs → ${slFile}`);
