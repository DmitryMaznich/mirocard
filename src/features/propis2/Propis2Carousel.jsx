import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { ROW_BASE, ROW_TOP, bboxOf, narrowStrokes, staysInRow } from "@/topics/renderers/propis2/glyphReach.js";

// Tiles of the deck's symbols (elements, letters, marks), each drawn with its own captured strokes (not a font), so the
// adult sees exactly what the child will write. The constructor shows the elements in its element list.
const LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
const UPPER = LOWER.toUpperCase();


// Every tile shows a piece of the NARROW row (thin top line, dashed middle, bold baseline) with the symbol on
// it, all at the same scale: the symbol is the one the engine lays out on the narrow ruling (the same
// strokes, stretch and 0.5 scale as on the page), so a letter on a tile is exactly as big as on the sheet and
// tiles of different letters can be compared by eye.
const ROW_MID = (ROW_TOP + ROW_BASE) / 2;
const MAX_TILE_SYMBOL_W = 100;

const LETTER_NAMES = new Set([...LOWER, ...UPPER]);

export function buildTiles(topicRecord) {
  const glyphMap = buildGlyphMap(topicRecord);
  const strokesOf = (label) => narrowStrokes(glyphMap, label);
  const wide = topicRecord?.wide ?? [];
  // a letter may be stored under another name and reached through an alias (г -> г1, п -> п1)
  const byLabel = new Map(wide.map((g) => [g.label, g]));
  for (const g of wide) for (const a of g.aliases ?? []) if (!byLabel.has(a)) byLabel.set(a, g);
  const make = (kind, id, caption) => ({ key: id, kind, text: id, caption, strokes: strokesOf(id) });
  const letters = (alphabet) => [...alphabet].filter((ch) => byLabel.has(ch)).map((ch) => make("text", ch, ch));
  const seen = new Set();
  const elements = [];
  for (const g of wide) {
    if (g.kind !== "element" || seen.has(g.label)) continue;
    // г п р л м я are stored as «elements» in the deck but are letters: they live under the letters, not here
    if ([g.label, ...(g.aliases ?? [])].some((n) => LETTER_NAMES.has(n))) continue;
    seen.add(g.label);
    elements.push(make("element", g.label, g.label));
  }
  for (const el of topicRecord?.elements ?? []) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    elements.push(make("element", el.id, el.labelRu ?? el.id));
  }
  // punctuation marks of the deck (wide.json kind "punct"), in the order of a sentence
  const marks = [".", ",", "!", "?"].filter((m) => byLabel.get(m)?.kind === "punct").map((m) => make("text", m, m));
  const out = { elements, lower: letters(LOWER), upper: letters(UPPER), marks };

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
  const sw = bare ? Math.max(2, side / 14) : 1.6; // ink width in row units
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
