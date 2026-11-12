// Slovenian school cursive, small letters (slovenske pisane črke) — docs/propis2-sl.md, step 3.
//
// Drawn here from lines and arcs (the reference file is NOT copied: it is a model to measure against, its outlines never enter the
// repository). What the Slovene norm asks for, and what was measured on the school model «Male pisane črke» (2026-11-12):
//   - upright letters, three equal bands — the same band units as print.mjs (top line 0, x-line 50, baseline 100, bottom line 150);
//   - every letter starts ON THE BASELINE with a rising lead-in from the left («začetni spodnji zamah»);
//   - every letter ends with an exit stroke half-way up the x band (y ≈ 74), except b o r v — those end at the top (y ≈ 50);
//   - one movement per letter (enopoteznost): the pen goes back over its own line rather than lifting (d, the stems of h k m n p r t);
//     only the dots of i j, the bar of t, the carons of č š ž and the exit of f (the model writes f in two strokes, «z eno ali dvema
//     potezama») are lifts;
//   - no decoration.
// Each path runs in the writing direction (its first point is the start dot). Width = where the exit ends.
//
// Run: node tools/latin_letters/glyphs/slovene.mjs → slovene.json next to this file.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { arc, dot, line, s } from "./geom.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const printSl = JSON.parse(readFileSync(here("./print_sl.json"), "utf8"));

// the exit from a stem at x coming down to the baseline: round the corner, up to the right to half the x band
const exitFrom = (x, end = x + 36) => `L ${x},88 C ${x},95 ${x + 3.5},98.5 ${x + 9},98.5 C ${x + 19},98.5 ${end - 8},88 ${end},74`;
// the lead-in that runs up the left side of an oval (centre cx, radii rx ry) and the oval written anticlockwise from its top
// back round to its right side: a c d g o; returns the path and the oval's right x
const ovalWithLeadIn = (cx, rx, ry, cy = 75, end = 0) => {
  const a = 200; // where the lead-in meets the oval (degrees, screen: 180 = left, 270 = top): a straight rise, touching its upper left
  const [mx, my] = [cx + rx * Math.cos((a * Math.PI) / 180), cy + ry * Math.sin((a * Math.PI) / 180)];
  return `M 1.5,98.5 L ${mx.toFixed(2)},${my.toFixed(2)} ${arc(cx, cy, rx, ry, a, 270, { move: false })} ${arc(cx, cy, rx, ry, 270, end, { move: false })}`;
};
// a d g: the lead-in up the oval's left side, over its top to its upper right and on up to the top of the stem (x = cx + rx); back
// down to the oval (the pen goes over its own line, enopoteznost), round it anticlockwise to its right side, up the stem's line to its top
const ovalToStem = (cx, rx, ry) => {
  const sx = cx + rx, top = 75 - ry;
  const [mx, my] = [cx + rx * Math.cos((200 * Math.PI) / 180), 75 + ry * Math.sin((200 * Math.PI) / 180)];
  const [ux, uy] = [cx + rx * Math.cos((330 * Math.PI) / 180), 75 + ry * Math.sin((330 * Math.PI) / 180)].map((n) => n.toFixed(2));
  return `M 1.5,98.5 L ${mx.toFixed(2)},${my.toFixed(2)} ${arc(cx, 75, rx, ry, 200, 330, { move: false })} L ${sx},${top} L ${ux},${uy} ${arc(cx, 75, rx, ry, 330, 0, { move: false })} L ${sx},${top}`;
};
// the tall loop of b f h k l: the lead-in straight up to the loop's right side, round its top, down the stem at x
const loopUp = (x) => `M 1.5,98.5 L ${x},50 C ${x + 6},41 ${x + 17},26 ${x + 20},13 C ${x + 22},5 ${x + 17},0.5 ${x + 12},0.5 C ${x + 5},0.5 ${x},8 ${x},20`;

const lower = {
  a: [88.5, [s(`${ovalToStem(35, 19, 24)} ${exitFrom(54, 88.5)}`, "овал и палочка")]],
  b: [87, [s(`${loopUp(40)} L 40,88 C 40,95 44,98.5 51,98.5 C 59,98.5 63,93 63,84 L 63,52 L 63,66 C 64,70 70,70 75,67 C 80,64 85,58 87,52`, "петля и полуовал")]],
  c: [61.5, [s(`M 1.5,98.5 L 15.56,66.79 ${arc(32,75,17.5,24,200,325,{ move: false })} ${arc(32,75,17.5,24,325,90,{ move: false })} C 45,99 55,88 61.5,74`, "полуовал")]],
  d: [88.5, [s(`${ovalToStem(35, 19, 24)} L 54,1 ${exitFrom(54, 88.5)}`, "овал и палочка")]],
  e: [61.5, [s("M 1.5,98.5 C 15,87 32,78 38,70 C 42,64 41,51 33,51 C 26,51 23,58 24,70 C 25,85 28,99 37,99 C 47,99 55,88 61.5,75", "петелька")]],
  f: [68, [s(`${loopUp(38.5)} L 38.5,147.5`, "петля и палочка вниз"), s("M 25,88 C 27,95 32,99 40,99 C 52,99 62,88 68,75", "выход")]],
  g: [74, [s(`${ovalToStem(35, 19, 24)} L 54,138 C 54,145 51,148 46,148 C 40,148 35,143 35,136 C 35,124 46,110 54,100 C 60,92 67,84 74,74`, "овал и петля внизу")]],
  h: [105, [s(`${loopUp(39)} L 39,98.5 L 39,72 C 42,58 50,51 57,51 C 66,51 72.5,58 72.5,68 ${exitFrom(72.5, 105)}`, "петля и горка")]],
  i: [73.5, [s(`M 1.5,98.5 L 37.5,51 ${exitFrom(37.5, 73.5)}`, "палочка"), dot(36.5, 33.5, 1.2)]],
  j: [57.5, [s("M 1.5,98.5 L 36.5,51 L 36.5,138 C 36.5,145 33,148 28,148 C 21,148 17,142 17.5,135 C 18,124 28,110 36.5,100 C 43,92 50,84 57.5,74", "палочка с петлёй"), dot(36.5, 33.5, 1.2)]],
  k: [102.5, [s(`${loopUp(38.5)} L 38.5,98.5 L 38.5,62 C 42,55 49,51 56,51 C 65,51 71.5,56 71.5,63 C 71.5,71 62,76 50,76 C 58,78 63,98.5 75,98.5 C 86,98.5 95,88 102.5,74`, "петля, ушко и ножка")]],
  l: [75, [s(`${loopUp(39)} ${exitFrom(39, 75)}`, "петля")]],
  m: [130, [s(`M 1.5,98.5 C 15,77 30,51 38,51 C 42,51 44,54 44,60 L 44,98.5 L 44,62 C 47,55 51,51 57,51 C 65,51 69,57 69,64 L 69,98.5 L 69,62 C 72,55 76,51 82,51 C 90,51 95,57 95,64 ${exitFrom(95, 130)}`, "три горки")]],
  n: [105, [s(`M 1.5,98.5 C 15,77 30,51 38,51 C 42,51 44,54 44,60 L 44,98.5 L 44,62 C 47,55 51,51 57,51 C 65,51 69,57 69,64 ${exitFrom(69, 105)}`, "две горки")]],
  o: [79, [s(`${ovalWithLeadIn(35, 17.5, 24.5, 75, -90)} C 43,50.5 49,60 55,66 C 62,72 70,58 79,50`, "овал с выходом наверху")]],
  p: [103.5, [s(`M 1.5,98.5 L 36.5,50 L 36.5,147.5 L 36.5,64 C 40,56 47,50 55,50 C 65,50 70,58 70,68 ${exitFrom(70, 103.5)}`, "палочка вниз и горка")]],
  r: [74, [s("M 1.5,98.5 C 15,77 30,51 40,51 C 46,51 50,53 50,58 L 50,98.5 L 50,66 C 51,70 57,70 62,67 C 67,64 72,58 74,52", "горка, палочка и чашечка")]],
  s: [58, [s("M 1.5,98.5 L 37.5,50 C 44,62 58,68 58,82 C 58,92 52,99 46,99 C 39,99 34,95 33,90", "острый верх и полуовал")]],
  t: [75, [s(`M 1,98.5 C 12,88 30,74 38.5,60 L 38.5,1 ${exitFrom(38.5, 75)}`, "палочка"), s(line([25, 50], [52.5, 50]), "черта")]],
  u: [100, [s(`M 1.5,98.5 C 15,90 32,70 37.5,50 L 37.5,88 C 37.5,95 41,98.5 47.5,98.5 C 57,98.5 64,90 64,78 L 64,50 ${exitFrom(64, 100)}`, "две палочки")]],
  v: [88, [s("M 1.5,98.5 C 15,77 30,51 38,51 C 42,51 44,54 44,60 L 44,88 C 44,95 48,98.5 54,98.5 C 60,98.5 64,93 64,84 L 64,52 L 64,66 C 65,70 71,70 76,67 C 81,64 86,58 88,52", "горка с выходом наверху")]],
  z: [88, [s("M 1.5,98.5 C 15,78 30,51 40,51 C 45,51 47,57 53,58 C 60,59 66,56 70,52 L 35,97.5 C 40,92 48,89 53,92 C 57,95 59,99 64,99 C 74,99 82,88 88,75", "зигзаг")]],
};
// č š ž: the letter, then the caron (a lift — «strešico … napiše nazadnje»), where the model has it: two thirds up the ascender band
const caron = (cx) => s(line([cx - 10, 20], [cx, 36], [cx + 10, 20]), "гачек");
for (const [base, ch, cx] of [["c", "č", 34], ["s", "š", 37.5], ["z", "ž", 57]]) lower[ch] = [lower[base][0], [...lower[base][1], caron(cx)]];

// capitals, digits, signs: the Slovenian print ones for now (the cursive capitals come next, after the small letters are agreed)
const glyphs = Object.fromEntries(Object.entries(printSl.glyphs).filter(([, g]) => g.case !== "lower"));
for (const [ch, [width, strokes]] of Object.entries(lower)) glyphs[ch] = { case: "lower", width, strokes };

writeFileSync(here("./slovene.json"), JSON.stringify({ style: "slovene", title: { ru: "Письменные (словенские)", sl: "Pisane črke" }, ruling: printSl.ruling, glyphs }, null, 1) + "\n");
console.log(`wrote ${Object.keys(glyphs).length} glyphs (${Object.keys(lower).length} cursive small letters) → tools/latin_letters/glyphs/slovene.json`);
