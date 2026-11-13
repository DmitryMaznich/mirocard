// Slovenian school cursive, small letters (slovenske pisane črke) — docs/propis2-sl.md, step 3.
//
// Drawn here from lines and arcs (the reference file is NOT copied: it is a model to measure against, its outlines never enter the
// repository). What the Slovene norm asks for, and what was measured on the school model «Male pisane črke» (2026-11-12):
//   - upright letters, three equal bands — the same band units as print.mjs (top line 0, x-line 50, baseline 100, bottom line 150);
//   - every letter starts ON THE BASELINE with a rising lead-in from the left («začetni spodnji zamah»);
//   - every letter ends with an exit stroke half-way up the x band (y ≈ 74), except b o r v — those end at the top (y ≈ 50);
//   - one movement per letter (enopoteznost): the pen goes back over its own line rather than lifting (d, the stems of h k m n p r t);
//     only the dots of i j, the bar of t, the carons of č š ž, the hook of r (written after the stem, from the x-line: owner,
//     2026-11-13, as in the model) and the exit of f (the model writes f in two strokes, «z eno ali dvema
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
// a d g (owner, 2026-11-13): the lead-in up the oval's left side and over its top as far as the stem's line, then BACK round the
// oval (over its top again, down its left side, round its bottom) to its right side, and from there up the stem's line to the stem's
// top — the x-line for a g, the top line for d; then down (the exit, or g's loop). No climb to the stem's top before the oval: the
// pen went up there first and came back, a spike at the top.
const ovalToStem = (cx, rx, ry, stemTop = 75 - ry) => {
  const sx = cx + rx;
  const [mx, my] = [cx + rx * Math.cos((200 * Math.PI) / 180), 75 + ry * Math.sin((200 * Math.PI) / 180)];
  return `M 1.5,98.5 L ${mx.toFixed(2)},${my.toFixed(2)} ${arc(cx, 75, rx, ry, 200, 330, { move: false })} ${arc(cx, 75, rx, ry, 330, 0, { move: false })} L ${sx},${stemTop}`;
};
// the tall loop of b f h k l: the lead-in straight up to the loop's right side, round its top, down the stem at x
const loopUp = (x) => `M 1.5,98.5 L ${x},50 C ${x + 6},41 ${x + 17},26 ${x + 20},13 C ${x + 22},5 ${x + 17},0.5 ${x + 12},0.5 C ${x + 5},0.5 ${x},8 ${x},20`;

const lower = {
  a: [88.5, [s(`${ovalToStem(35, 19, 24)} ${exitFrom(54, 88.5)}`, "овал и палочка")]],
  b: [87, [s(`${loopUp(40)} L 40,88 C 40,95 44,98.5 51,98.5 C 59,98.5 63,93 63,84 L 63,52 L 63,66 C 64,70 70,70 75,67 C 80,64 85,58 87,52`, "петля и полуовал")]],
  c: [61.5, [s(`M 1.5,98.5 L 15.56,66.79 ${arc(32,75,17.5,24,200,325,{ move: false })} ${arc(32,75,17.5,24,325,90,{ move: false })} C 45,99 55,88 61.5,74`, "полуовал")]],
  d: [88.5, [s(`${ovalToStem(35, 19, 24, 1)} ${exitFrom(54, 88.5)}`, "овал и палочка")]],
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
  r: [74, [s("M 1.5,98.5 C 15,77 30,51 40,51 C 46,51 50,53 50,58 L 50,98.5", "горка и палочка"), s("M 50,53 C 51,64 56,69 62,67 C 67,65 72,58 74,52", "крючок")]],
  s: [60, [s("M 1.5,98.5 L 37,51.5 C 36.5,57 38,62 44,64.5 C 54,68 60,73 60,82 C 60,92 53,98 45,98 C 39,98 35,95 33,91", "острый верх и полуовал")]],
  t: [75, [s(`M 1,98.5 C 12,88 30,74 38.5,60 L 38.5,1 ${exitFrom(38.5, 75)}`, "палочка"), s(line([25, 50], [52.5, 50]), "черта")]],
  u: [100, [s(`M 1.5,98.5 C 15,90 32,70 37.5,50 L 37.5,88 C 37.5,95 41,98.5 47.5,98.5 C 57,98.5 64,90 64,78 L 64,50 ${exitFrom(64, 100)}`, "две палочки")]],
  v: [88, [s("M 1.5,98.5 C 15,77 30,51 38,51 C 42,51 44,54 44,60 L 44,88 C 44,95 48,98.5 54,98.5 C 60,98.5 64,93 64,84 L 64,52 L 64,66 C 65,70 71,70 76,67 C 81,64 86,58 88,52", "горка с выходом наверху")]],
  z: [88, [s("M 1.5,98.5 C 15,78 30,51 40,51 C 45,51 47,57 53,58 C 60,59 66,56 70,52 L 35,97.5 C 40,92 48,89 53,92 C 57,95 59,99 64,99 C 74,99 82,88 88,75", "зигзаг")]],
};
// č š ž: the letter, then the caron (a lift — «strešico … napiše nazadnje»), where the model has it: two thirds up the ascender band
const caron = (cx) => s(line([cx - 10, 20], [cx, 36], [cx + 10, 20]), "гачек");
for (const [base, ch, cx] of [["c", "č", 34], ["s", "š", 37.5], ["z", "ž", 57]]) lower[ch] = [lower[base][0], [...lower[base][1], caron(cx)]];

// Capitals (pisane velike črke) — step 3, read off the owner's «ABECEDA» picture (the same school model as «Male pisane črke» and
// the «Znam pisati» sheet) on the band grid, scaled by the small letters next to them: capitals as tall as the ascenders (top line 0),
// G and J down to the descender line; most capitals start with a hook or a curl at the top left. In that picture P R S Š T stand
// about 7 % taller than the other capitals: brought to the top line (`fitTop`, a stretch about the baseline). The top bar of F and T
// sags a little (owner, 2026-11-12: «верхний штрих слегка прогнуть вниз»); the stem starts on it. So does the top of Z Ž.
// Stroke order and count after the UČIMse chart (Mladinska knjiga, 2016, «Učenje poteznosti pisanja velikih in malih pisanih črk»):
// F — stem 1, top 2, bar 3; T — stem 1, top 2; H — ONE stroke (2026-11-13).
const fitTop = (d, k = 100 / 107) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${x},${+(100 - (100 - Number(y)) * k).toFixed(2)}`);
// a caron over a capital: above the top line
const capCaron = (cx) => s(line([cx - 10, -17], [cx, -8], [cx + 10, -17]), "гачек");
const upper = {
  A: [103, [s("M 6,77 C 6,95 12,101 19,101 C 30,101 37,88 37,70 C 37,35 45,0 61,0 C 70,0 73,10 73,30 L 73,92 C 73,98 76,101 80,101 C 90,101 97,88 103,74", "петелька, левая и правая палочки"), s(line([26, 62], [81, 62]), "черта")]],
  B: [84, [s("M 39.5,2 L 39.5,88 C 39.5,97 32,101 22,101 C 12,101 6,92 6,78", "палочка с крючком"), s("M 17.5,41.5 C 9,35 6,27 9,19 C 14,7 28,2 41,2 C 58,2 68,10 68,21 C 68,33 58,42 48,44 C 66,46 84,55 84,76 C 84,93 74,101 61,101 C 52,101 46,95 46,82", "завиток и два полуовала")]],
  C: [74, [s("M 4,40 C 12,46 22,48 32,46 C 48,42 62,28 64,14 C 65,6 60,2 54,2 C 38,2 25,30 25,62 C 25,88 36,101 51,101 C 62,101 69,92 74,77", "петля и полуовал")]],
  D: [80, [s("M 31,8 L 31,90 C 31,98 27,102 20,102 C 11,102 4,99 4,93 C 4,86 10,82 17,82 C 24,82 28,86 32,92 C 36,98 44,102 52,102 C 70,102 80,85 80,60 C 80,28 62,5 40,5 C 22,5 6,15 4,27 C 3,36 6,42 9,47", "палочка, петелька через палочку и дуга")]],
  E: [63, [s("M 4,3 C 8,12 14,20 22,23 C 32,25 46,20 48,10 C 49,4 45,1 40,1 C 30,1 22,10 22,22 C 22,32 26,40 30,44 L 45,45 L 30,45 C 20,48 11,60 11,75 C 11,92 22,101 36,101 C 48,101 57,91 63,77", "две петли")]],
  F: [76, [s("M 41,3.6 C 42,30 46,55 46,78 C 46,93 40,100 32,100 C 23,100 18,92 18,78", "палочка с крючком"), s("M 16,38 C 8,33 4,26 5,19 C 7,8 18,2 34,2 C 48,6 64,6.5 77,2.5", "завиток и верхняя черта"), s(line([24, 50], [60, 50]), "черта")]],
  G: [86, [s("M 4,40 C 12,46 22,50 34,47 C 50,43 66,28 68,14 C 69,7 63,4 56,4 C 38,4 23,30 23,62 C 23,88 32,101 45,101 C 58,101 71,92 71,75 L 71,55 L 71,135 C 71,145 66,152 58,152 C 50,152 46,146 46,138 C 46,124 60,108 71,98 C 76,92 81,84 86,77", "петля, полуовал и петля внизу")]],
  H: [89, [s("M 11,32 C 6,28 4,22 5,17 C 7,8 13,3 22,3 L 40,3 L 40,90 C 40,98 34,102 27,102 C 19,102 14,96 14,88 C 14,75 40,58 55,47 C 68,37 79,25 79,15 C 79,7 75,3 69,3 C 63,3 61,10 61,25 L 61,92 C 61,98 64,102 69,102 C 78,102 84,90 89,77", "завиток, палочка, петля и вторая палочка")]],
  I: [41, [s("M 9,27 C 5,22 3,16 5,12 C 8,7 14,6 22,6 L 41,6 L 41,86 C 41,96 34,101 25,101 C 15,101 8,92 8,77", "завиток, черта и палочка")]],
  J: [53, [s("M 9,27 C 5,22 3,16 5,12 C 8,7 14,6 22,6 L 41,6 L 41,112 C 41,134 37,152 26,152 C 16,152 11,146 11,137 C 11,122 30,102 41,92 C 45,88 49,83 53,78", "завиток, черта и палочка с петлёй")]],
  K: [101, [s("M 14,30 C 8,26 5,20 6,16 C 8,9 14,7 22,7 L 43,7 L 43,88 C 43,97 36,102 27,102 C 17,102 9,94 8,78", "завиток, черта и палочка"), s("M 86,7 C 77,6 68,14 64,26 C 61,36 58,46 43,48 C 55,49 62,54 66,64 C 70,75 69,90 72,96 C 74,100 77,102 81,102 C 91,102 97,90 101,78", "дуга и ножка")]],
  L: [71, [s("M 4,42 C 12,48 22,50 34,49 C 50,47 62,35 63,22 C 64,9 58,2 51,2 C 40,2 34,15 34,35 L 34,90 C 34,98 30,103 22,103 C 12,103 4,100 4,94 C 4,87 10,83 17,83 C 25,83 31,88 35,94 C 39,100 46,102 52,102 C 61,102 67,92 71,78", "петля и петелька через палочку внизу")]],
  M: [116, [s("M 4,78 C 4,93 11,101 20,101 C 31,101 37,88 39,70 C 42,45 46,8 51,3 C 54,8 55,60 57,93 C 60,60 72,10 81,2 C 85,20 88,60 90,85 C 91,96 94,101 98,101 C 107,101 112,88 116,75", "крючок и два острых верха")]],
  N: [96, [s("M 9,77 C 7,93 14,102 23,102 C 33,102 38,90 39,70 C 40,40 40,10 41,3 C 50,30 62,70 66,98 C 66,70 68,30 72,18 C 75,9 79,4 85,4 C 92,4 96,9 96,15 C 96,22 92,27 88,29", "крючок, острый верх и завиток")]],
  O: [101, [s("M 4,2 C 8,12 14,20 24,23 C 34,25 48,20 50,10 C 51,4 47,1 43,1 C 31,1 24,15 24,40 L 24,70 C 24,90 34,101 46,101 C 60,101 68,88 69,65 L 69,15 C 69,6 66,3 63,4 C 60,5 59,10 62,12 C 68,15 84,12 101,5", "петля, овал и выход наверху")]],
  P: [73, [s(fitTop("M 41,0 C 33,20 33,50 40,70 C 45,85 40,101 28,101 C 18,101 11,93 12,84 C 13,78 16,75 19,73"), "палочка с крючком"), s(fitTop("M 13,43 C 6,36 4,28 5,20 C 8,4 24,-6 41,-6 C 60,-6 73,6 73,20 C 73,33 62,45 49,47"), "завиток и полуовал")]],
  R: [108, [s(fitTop("M 40,-5 C 36,20 35,48 38,68 C 40,80 41,88 38,94 C 35,99 30,101 23,101 C 13,101 6,94 7,85 C 8,79 11,75 14,73"), "палочка с крючком"), s(fitTop("M 19,37 C 12,31 10,24 12,17 C 16,3 30,-5 47,-5 C 66,-5 80,6 80,20 C 80,34 70,43 56,44 L 44,44 L 60,44 C 70,46 75,55 76,68 C 77,82 78,96 82,99 C 85,101 87,102 90,102 C 99,102 104,90 108,77"), "завиток, полуовал и ножка")]],
  S: [60, [s(fitTop("M 4,25 C 10,34 18,41 28,43 C 42,45 58,36 59,20 C 60,4 53,-8 44,-8 C 34,-8 27,2 28,14 C 29,30 40,50 42,68 C 44,88 36,103 24,103 C 13,103 7,94 8,84 C 9,77 12,72 16,68"), "петля и палочка с крючком")]],
  T: [89, [s(fitTop("M 44,-3.6 C 47,20 54,50 54,72 C 54,92 46,103 33,103 C 23,103 17,95 17,86 C 17,80 20,74 24,70"), "палочка с крючком"), s(fitTop("M 18,30 C 9,26 4,20 5,13 C 6,2 14,-5 28,-6 C 46,-2 70,-2 89,-8"), "завиток и черта")]],
  U: [106, [s("M 4,17 C 12,8 22,0 32,-1 C 37,-1 38,8 38,25 L 37,65 C 37,90 44,101 52,101 C 64,101 73,92 74,75 L 74,-1 L 74,90 C 74,97 78,101 84,101 C 94,101 101,88 106,74", "две палочки")]],
  V: [111, [s("M 4,15 C 12,6 24,-2 34,-3 C 40,-3 41,8 41,25 L 39,70 C 39,92 46,101 55,101 C 66,101 71,90 71,72 L 71,10 C 71,3 69,-2 66,-1 C 63,0 63,5 66,8 C 72,13 92,8 111,-4", "палочка, полуовал и выход наверху")]],
  Z: [74, [s("M 18,17 C 15,12 14,6 17,3 C 21,-1 28,0 36,2 C 50,5.5 62,4.5 71,-1 L 5,98 C 12,93 20,89 30,91 C 40,93 44,102 53,102 C 63,102 69,90 74,75", "зигзаг"), s(line([19, 43], [58, 43]), "черта")]],
};
upper["Č"] = [upper.C[0], [...upper.C[1], capCaron(52)]];
upper["Š"] = [upper.S[0], [...upper.S[1], capCaron(44)]];
upper["Ž"] = [upper.Z[0], [...upper.Z[1], capCaron(52)]];

// digits and signs: the Slovenian print ones (print_sl.json)
const glyphs = Object.fromEntries(Object.entries(printSl.glyphs).filter(([, g]) => g.case === "sign"));
for (const [ch, [width, strokes]] of Object.entries(upper)) glyphs[ch] = { case: "upper", width, strokes };
for (const [ch, [width, strokes]] of Object.entries(lower)) glyphs[ch] = { case: "lower", width, strokes };

writeFileSync(here("./slovene.json"), JSON.stringify({ style: "slovene", title: { ru: "Письменные (словенские)", sl: "Pisane črke" }, ruling: printSl.ruling, glyphs }, null, 1) + "\n");
console.log(`wrote ${Object.keys(glyphs).length} glyphs (${Object.keys(lower).length} cursive small letters) → tools/latin_letters/glyphs/slovene.json`);
