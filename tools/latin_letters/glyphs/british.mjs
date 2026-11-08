// British (Nelson-style) letters — the second English style (docs/latin-letters.md). Forms after the Nelson Handwriting Ready
// Reference Guide, «the lower-case alphabet for Books 1 to 6» (docs/research/handwriting/nelson-uk): the print letters with an EXIT FLICK
// on the thirteen letters a c d e h i k l m n t u (joining group 1; c and e end low on the right already), a looped k, an f that goes
// below the baseline, a q whose tail turns right, a y with a rounded top, a plain stick I; the capitals are the plain print ones.
// Drawn in the same band units as print.mjs (band = 50: top line 0, x-line 50, baseline 100, bottom line 150) with EQUAL bands; the
// British proportions (ascenders 0.74, descenders 0.72 of the x-height, capitals as tall as the ascenders) are applied when the letters
// are built for the engine (tools/handwriting/latin/build-print.mjs --style british).
// Written apart for now: the joins (Nelson's four joins and the break letters) are the next step.
//
// Run: node tools/latin_letters/glyphs/british.mjs  → british.json next to this file.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { arc, line, dot, s } from "./geom.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const print = JSON.parse(readFileSync(here("./print.json"), "utf8"));

// a stem coming down to the baseline at x and turning into the exit flick: round the corner and up to the right
const FLICK = (x) => `L ${x},88 C ${x},96 ${x + 5},100 ${x + 10},100 C ${x + 14},100 ${x + 17},97 ${x + 19},93`;
const stemFlick = (x, top) => `M ${x},${top} ${FLICK(x)}`;
const BOWL = arc(25, 75, 25, 25, -30, -390); // a d g q: from 1 o'clock back round, as in print

const own = {
  a: [69, [s(BOWL, "овал"), s(stemFlick(50, 50), "палочка с хвостиком")]],
  d: [69, [s(BOWL, "овал"), s(stemFlick(50, 0), "палочка с хвостиком")]],
  h: [69, [s(line([0, 0], [0, 100]), "палочка"), s(`${arc(25, 75, 25, 25, 180, 360)} ${FLICK(50)}`, "горка с хвостиком")]],
  i: [24, [s(stemFlick(5, 50), "палочка с хвостиком"), dot(5, 30)]],
  k: [44, [
    s(line([0, 0], [0, 100]), "палочка"),
    s("M 0,82 C 10,56 40,50 38,64 C 36,76 16,79 3,79 L 30,96 C 34,99 38,100 44,96", "петля и ножка"),
  ]],
  l: [24, [s(stemFlick(5, 0), "палочка с хвостиком")]],
  m: [89, [
    s(line([0, 50], [0, 100]), "палочка"),
    s(`${arc(17.5, 70, 17.5, 20, 180, 360)} L 35,100`, "горка"),
    s(`${arc(52.5, 70, 17.5, 20, 180, 360)} ${FLICK(70)}`, "горка с хвостиком"),
  ]],
  n: [69, [s(line([0, 50], [0, 100]), "палочка"), s(`${arc(25, 75, 25, 25, 180, 360)} ${FLICK(50)}`, "горка с хвостиком")]],
  t: [44, [s(stemFlick(15, 15), "палочка с хвостиком"), s(line([0, 50], [35, 50]), "черта")]],
  u: [69, [s(`${line([0, 50], [0, 78])} ${arc(25, 78, 25, 22, 180, 0, { move: false })}`, "крючок"), s(stemFlick(50, 50), "палочка с хвостиком")]],
  f: [45, [s(`${arc(35, 20, 15, 15, -30, -180)} L 20,132 C 20,146 8,149 1,139`, "крючок, палочка вниз"), s(line([5, 50], [40, 50]), "черта")]],
  q: [64, [s(BOWL, "овал"), s("M 50,50 L 50,138 C 50,146 56,150 64,143", "палочка с хвостом вправо")]],
  y: [50, [
    s(`${line([0, 50], [0, 78])} ${arc(25, 78, 25, 22, 180, 0, { move: false })}`, "крючок"),
    s(`${line([50, 50], [50, 130])} ${arc(30, 130, 20, 20, 0, 160, { move: false })}`, "палочка с петелькой"),
  ]],
  I: [10, [s(line([5, 0], [5, 100]), "палочка")]],
};

const glyphs = { ...print.glyphs };
for (const [ch, [width, strokes]] of Object.entries(own)) glyphs[ch] = { case: glyphs[ch].case, width, strokes };

const out = { style: "british", title: { ru: "Британские", en: "British" }, ruling: print.ruling, glyphs };
writeFileSync(here("./british.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${Object.keys(glyphs).length} glyphs (${Object.keys(own).length} own) → tools/latin_letters/glyphs/british.json`);
