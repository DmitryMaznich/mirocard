import DIGIT_GLYPHS from "./digitGlyphs.json";

// A school mark written in red ink: the digit is the topic's own captured glyph (the same trajectory the notebook uses, stretched
// like the engine does), the + / − and the underline are drawn here. Every stroke is revealed one after another (pathLength 1 +
// dash offset), so it looks like the pen writes it. Only «Диктант» uses it (the adult marks the child's notebook). The component is GradeStamp.jsx.

// The adult can give 3, 4 or 5 (children with special needs: no point in a negative mark), optionally with + or −; the glyphs of 1 and 2 exist too.
export const GRADE_DIGITS = [3, 4, 5];
export const GRADE_SIGNS = ["+", "−"];
export const gradeText = (g) => (g ? `${g.n}${g.sign || ""}` : "");

const STRETCH = 1.806; // the engine stretches every glyph in x by this
const BY_LABEL = new Map(DIGIT_GLYPHS.map((g) => [g.label, g]));
const STROKE_MS = [620, 420]; // digit stroke, sign stroke
const SWOOSH_MS = 380;

function bounds(strokes) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const s of strokes) {
    const v = s.d.match(/-?\d+\.?\d*/g).map(Number);
    for (let i = 0; i + 1 < v.length; i += 2) {
      minx = Math.min(minx, v[i]); maxx = Math.max(maxx, v[i]);
      miny = Math.min(miny, v[i + 1]); maxy = Math.max(maxy, v[i + 1]);
    }
  }
  return { minx, maxx, miny, maxy };
}

// The strokes of a mark in a local box (0,0)-(w,h): [{ d, ms }] in writing order.
export function gradeStrokes(grade) {
  const glyph = BY_LABEL.get(`№${grade.n}`);
  if (!glyph) return { w: 0, h: 0, strokes: [], totalMs: 0 };
  const b = bounds(glyph.strokes);
  const pad = 10;
  // x: stretched, then shifted to the box; y: shifted so the top of the digit is at `pad`.
  const fx = (x) => ((x - b.minx) * STRETCH + pad).toFixed(1);
  const fy = (y) => (y - b.miny + pad).toFixed(1);
  const strokes = glyph.strokes.map((s) => {
    let i = 0;
    const d = s.d.replace(/-?\d+\.?\d*/g, (m) => (i++ % 2 === 0 ? fx(Number(m)) : fy(Number(m))));
    return { d, ms: STROKE_MS[0] };
  });
  const digitW = (b.maxx - b.minx) * STRETCH + pad * 2;
  const h = b.maxy - b.miny + pad * 2;
  let w = digitW;
  if (grade.sign) {
    const sw = 40, sx = digitW - 4, sy = pad + 28; // the sign sits at the upper right, like a teacher's «5+»
    strokes.push({ d: `M ${sx} ${sy} L ${sx + sw} ${sy}`, ms: STROKE_MS[1] });
    if (grade.sign === "+") strokes.push({ d: `M ${sx + sw / 2} ${sy - sw / 2} L ${sx + sw / 2} ${sy + sw / 2}`, ms: STROKE_MS[1] });
    w = sx + sw + pad;
  }
  // The underline: a quick swoosh under the whole mark.
  const sy = h + 8;
  strokes.push({ d: `M 4 ${sy} C ${w * 0.3} ${sy - 9}, ${w * 0.65} ${sy + 7}, ${w - 2} ${sy - 4}`, ms: SWOOSH_MS });
  let at = 250; // a short pause before the pen touches the paper
  for (const s of strokes) { s.delay = at; at += s.ms + 90; }
  return { w, h: h + 22, strokes, totalMs: at };
}


// Total time the pen needs, so the caller can show «Дальше» only after the mark is written.
export const gradeWriteMs = (grade) => gradeStrokes(grade).totalMs;
