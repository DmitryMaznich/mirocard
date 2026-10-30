import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { ROW_BASE, ROW_TOP, bboxOf, narrowStrokes, staysInRow } from "@/topics/renderers/propis2/glyphReach.js";
import { NARROW_CELL, snapXFor } from "@/topics/renderers/propis/PrintPageView.jsx";
import { RU_LOWER, topicAlphabet } from "@/topics/renderers/propis2/alphabet.js";

// Tiles of the deck's symbols (elements, letters, marks), each drawn with its own captured strokes (not a font), so the
// adult sees exactly what the child will write. The constructor shows the elements in its element list.


// Every tile shows a piece of the NARROW row (thin top line, dashed middle, bold baseline) with the symbol on
// it, all at the same scale: the symbol is the one the engine lays out on the narrow ruling (the same
// strokes, stretch and 0.5 scale as on the page), so a letter on a tile is exactly as big as on the sheet and
// tiles of different letters can be compared by eye.
const ROW_MID = (ROW_TOP + ROW_BASE) / 2;
const MAX_TILE_SYMBOL_W = 100;
// The element tiles show the whole ruling the page has around the narrow row (measured on the printed dense ruling, narrow-row units):
// the wide row's own dashed lines one narrow gap above the thin line and below the baseline, and the slant every SLANT_STEP
// (the dense grid's step at the narrow scale), at 65 degrees from the horizontal: tan(25 deg) of run per unit of height.
const WIDE_TOP = ROW_TOP - (ROW_BASE - ROW_TOP);
const WIDE_BOTTOM = ROW_BASE + (ROW_BASE - ROW_TOP);
const SLANT_RUN = 0.46631;
// an element stands in its tile where the page puts it: its start on a line of the dense slant grid of the narrow ruling
const TILE_SNAP = snapXFor({ narrowRows: true, simpleGrid: "dense", margin: "off", format: "a5", narrow17: true });

// any Cyrillic letter name (not only the deck's alphabet): a letter stored as an «element» is never listed with the elements
const LETTER_NAMES = new Set([...RU_LOWER, ...RU_LOWER.toUpperCase()]);

export function buildTiles(topicRecord) {
  const glyphMap = buildGlyphMap(topicRecord);
  const strokesOf = (label) => narrowStrokes(glyphMap, label);
  const wide = topicRecord?.wide ?? [];
  // a letter may be stored under another name and reached through an alias (г -> г1, п -> п1)
  const byLabel = new Map(wide.map((g) => [g.label, g]));
  for (const g of wide) for (const a of g.aliases ?? []) if (!byLabel.has(a)) byLabel.set(a, g);
  // the engine repeats a lone element along the row (a chain of copies): a tile shows the element itself, the strokes of its own glyph, not the chain
  const ownStrokes = (id, strokes) => (byLabel.get(id)?.strokes?.length ? strokes.slice(0, byLabel.get(id).strokes.length) : strokes);
  const make = (kind, id, caption, snap) => ({ key: id, kind, text: id, caption, strokes: snap ? ownStrokes(id, narrowStrokes(glyphMap, id, snap)) : strokesOf(id) });
  const letters = (alphabet) => [...alphabet].filter((ch) => byLabel.has(ch)).map((ch) => make("text", ch, ch));
  const seen = new Set();
  const elements = [];
  for (const g of wide) {
    if (g.kind !== "element" || seen.has(g.label)) continue;
    // г п р л м я are stored as «elements» in the deck but are letters: they live under the letters, not here
    if ([g.label, ...(g.aliases ?? [])].some((n) => LETTER_NAMES.has(n))) continue;
    seen.add(g.label);
    elements.push(make("element", g.label, g.label, TILE_SNAP));
  }
  for (const el of topicRecord?.elements ?? []) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    elements.push(make("element", el.id, el.labelRu ?? el.id, TILE_SNAP));
  }
  // stable numbers (the deck's `elementNumbers`, tools/propis2/element_numbers.json): an element keeps its number whatever is added
  // or reordered; an element without one gets the next free number after the largest. The list is shown in number order.
  const numbers = topicRecord?.elementNumbers ?? {};
  let next = Math.max(0, ...Object.values(numbers)) + 1;
  for (const t of elements) t.no = Number.isInteger(numbers[t.text]) ? numbers[t.text] : next++;
  elements.sort((a, b) => a.no - b.no);
  // punctuation marks of the deck (wide.json kind "punct"), in the order of a sentence
  const marks = [".", ",", "!", "?"].filter((m) => byLabel.get(m)?.kind === "punct").map((m) => make("text", m, m));
  // the deck's own alphabet (alphabet.js: a variant deck has its own), capitals only of the letters that have one
  const alphabet = topicAlphabet(topicRecord);
  const lower = alphabet.lower.join("");
  const upper = alphabet.lower.filter((ch) => !alphabet.noCapital.has(ch)).join("").toUpperCase();
  const out = { elements, lower: letters(lower), upper: letters(upper), marks };

  // One frame for all tiles: tall enough for the highest ascender and the deepest descender of any symbol, wide
  // enough for the widest one, so every tile has the same size and the row stands at the same place in it.
  const all = [...out.elements, ...out.lower, ...out.upper, ...out.marks];
  let top = ROW_TOP - 4, bottom = ROW_BASE + 6, width = 40;
  for (const t of all) {
    t.box = bboxOf(t.strokes);
    t.inRow = out.marks.includes(t) ? ".,".includes(t.text) : staysInRow(t.box);
    if (!t.box) continue;
    top = Math.min(top, t.box.minY - 3); bottom = Math.max(bottom, t.box.maxY + 3);
    // very long elements (the picket fence) do not set the width: they are shown from their start and cut off
    if (t.box.maxX - t.box.minX <= MAX_TILE_SYMBOL_W) width = Math.max(width, t.box.maxX - t.box.minX + 8);
  }
  for (const t of all) {
    const cx = t.box ? (t.box.minX + t.box.maxX) / 2 : 0;
    const long = t.box && t.box.maxX - t.box.minX > MAX_TILE_SYMBOL_W;
    t.frame = { x: t.box ? (long ? t.box.minX - 4 : cx - width / 2) : 0, y: top, w: width, h: bottom - top };
  }
  // the element tiles: one frame of their own, from the wide row's top line to its bottom line (or further, for a tail), wide enough for the widest element
  let eTop = WIDE_TOP - 4, eBottom = WIDE_BOTTOM + 4, eWidth = 40;
  for (const t of out.elements) {
    if (!t.box) continue;
    eTop = Math.min(eTop, t.box.minY - 3); eBottom = Math.max(eBottom, t.box.maxY + 3);
    if (t.box.maxX - t.box.minX <= MAX_TILE_SYMBOL_W) eWidth = Math.max(eWidth, t.box.maxX - t.box.minX + 8);
  }
  for (const t of out.elements) {
    const cx = t.box ? (t.box.minX + t.box.maxX) / 2 : 0;
    const long = t.box && t.box.maxX - t.box.minX > MAX_TILE_SYMBOL_W;
    t.frame = { x: t.box ? (long ? t.box.minX - 4 : cx - eWidth / 2) : 0, y: eTop, w: eWidth, h: eBottom - eTop };
    t.ruled = true;
    // the grid line that passes through the element's start, at the baseline: the tile draws the slant through it, in steps of NARROW_CELL
    const start = t.strokes[0]?.match(/-?\d*\.?\d+/g)?.map(Number);
    t.slantX = start ? TILE_SNAP(0, start[0], start[1]) + (start[1] - ROW_BASE) * SLANT_RUN : 0;
  }
  return out;
}

export function TileGlyph({ tile, size = 56, bare = false }) {
  // word / text chips and anything without strokes: plain text
  if (!tile.strokes.length || !tile.frame) return <span className="propis2-chip-text" style={{ maxWidth: size * 3 }}>{tile.caption ?? tile.text}</span>;
  // bare (a category icon): just the ink, framed tightly in a square; otherwise the shared frame with the row lines
  const b = tile.box;
  const side = b ? Math.max(b.maxX - b.minX, b.maxY - b.minY) + 8 : 0;
  const { x, y, w, h } = bare && b
    ? { x: (b.minX + b.maxX) / 2 - side / 2, y: (b.minY + b.maxY) / 2 - side / 2, w: side, h: side }
    : tile.frame;
  const sw = bare ? Math.max(2, side / 14) : tile.ruled ? 2.2 : 1.6; // ink width in row units
  if (tile.ruled && !bare) {
    // an element: the slant, the wide row's dashed lines and the narrow row, so it is clear at a glance where it stands
    const slants = [];
    const a = tile.slantX ?? 0; // x of a grid line at the baseline
    for (let k = Math.floor((x - (ROW_BASE - y) * SLANT_RUN - a) / NARROW_CELL); k <= Math.ceil((x + w - (ROW_BASE - (y + h)) * SLANT_RUN - a) / NARROW_CELL); k++) {
      const x0 = a + k * NARROW_CELL + (ROW_BASE - (y + h)) * SLANT_RUN; // the line's x at the bottom of the frame
      slants.push(<line key={k} x1={x0} y1={y + h} x2={x0 + h * SLANT_RUN} y2={y} />);
    }
    return (
      <svg className="propis2-tile-glyph" width={size} height={Math.round((size * h) / w)} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true">
        <rect x={x} y={ROW_TOP} width={w} height={ROW_BASE - ROW_TOP} fill="#eef4ff" />
        <g stroke="#c4cad4" strokeWidth="0.45" fill="none">{slants}</g>
        <g fill="none">
          <line x1={x} x2={x + w} y1={WIDE_TOP} y2={WIDE_TOP} stroke="#d98a85" strokeWidth="0.7" strokeDasharray="2.4 1.6" />
          <line x1={x} x2={x + w} y1={WIDE_BOTTOM} y2={WIDE_BOTTOM} stroke="#d98a85" strokeWidth="0.7" strokeDasharray="2.4 1.6" />
          <line x1={x} x2={x + w} y1={ROW_TOP} y2={ROW_TOP} stroke="#8a8f98" strokeWidth="0.7" />
          <line x1={x} x2={x + w} y1={ROW_MID} y2={ROW_MID} stroke="#8a8f98" strokeWidth="0.6" strokeDasharray="2 1.4" />
          <line x1={x} x2={x + w} y1={ROW_BASE} y2={ROW_BASE} stroke="#555" strokeWidth="1.3" />
        </g>
        {tile.strokes.map((d, i) => <path key={i} d={d} fill="none" stroke="#1d4ed8" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
    );
  }
  return (
    <svg className="propis2-tile-glyph" width={size} height={bare ? size : Math.round((size * h) / w)} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true">
      {!bare && <g stroke="#8a8f98" strokeWidth="0.6" fill="none">
        <line x1={x} x2={x + w} y1={ROW_TOP} y2={ROW_TOP} />
        <line x1={x} x2={x + w} y1={ROW_MID} y2={ROW_MID} strokeDasharray="2 1.4" />
        <line x1={x} x2={x + w} y1={ROW_BASE} y2={ROW_BASE} strokeWidth="1.2" stroke="#555" />
      </g>}
      {tile.strokes.map((d, i) => <path key={i} d={d} fill="none" stroke="#1d4ed8" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
