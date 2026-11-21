import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { IN_ROW_MARKS, ROW_BASE, ROW_TOP, bboxOf, narrowStrokes, staysInRow } from "@/topics/renderers/propis2/glyphReach.js";
import { NARROW_CELL, snapXFor } from "@/handwriting/PrintPageView.jsx";
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

const GROUP_COLORS = ["#2b8be0", "#f59e0b", "#ec5547", "#37a64a", "#8b5cf6", "#e3559c", "#0f9f91", "#c08a00"];

export function buildTiles(topicRecord) {
  const glyphMap = buildGlyphMap(topicRecord);
  const strokesOf = (label) => narrowStrokes(glyphMap, label);
  const wide = topicRecord?.wide ?? [];
  // a letter may be stored under another name and reached through an alias (г -> г1, п -> п1)
  const byLabel = new Map(wide.map((g) => [g.label, g]));
  for (const g of wide) for (const a of g.aliases ?? []) if (!byLabel.has(a)) byLabel.set(a, g);
  const make = (kind, id, caption, snap) => ({ key: id, kind, text: id, caption, strokes: snap ? narrowStrokes(glyphMap, id, snap) : strokesOf(id) });
  const letters = (alphabet) => [...alphabet].filter((ch) => byLabel.has(ch)).map((ch) => make("text", ch, ch));
  const seen = new Set();
  const elements = [];
  for (const g of wide) {
    if (g.kind !== "element" || seen.has(g.label)) continue;
    // г п р л м я are stored as «elements» in the deck but are letters: they live under the letters, not here
    if ([g.label, ...(g.aliases ?? [])].some((n) => LETTER_NAMES.has(n))) continue;
    seen.add(g.label);
    const tile = make("element", g.label, g.labelRu ?? g.label, TILE_SNAP);
    // a rhythm pattern (`tileRepeat`, tools/propis2/rhythm): its tile shows it run on — the label that many times, chained as in a row
    // (a period ends where the next begins: each copy is the stroke moved by the distance from its start to its end)
    if (g.tileRepeat > 1 && tile.strokes.length) {
      const d = tile.strokes.join(" ");
      const nums = d.match(/-?\d*\.?\d+/g).map(Number);
      const dx = nums[nums.length - 2] - nums[0];
      const shift = (k) => tile.strokes.map((sd) => { let i = 0; return sd.replace(/-?\d*\.?\d+/g, (n) => (i++ % 2 === 0 ? String(Number(n) + k * dx) : n)); });
      tile.strokes = Array.from({ length: g.tileRepeat }, (_, k) => shift(k)).flat();
    }
    elements.push(tile);
  }
  for (const el of topicRecord?.elements ?? []) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    elements.push(make("element", el.id, el.labelRu ?? el.id, TILE_SNAP));
  }
  // stable numbers (the deck's `elementNumbers`, tools/propis2/element_numbers.json): an element keeps its number whatever is added
  // or reordered; an element without one gets the next free number after the largest (retired numbers stay taken).
  // The list is grouped (`elementGroups`: palochki, first hooks, ...): groups in their order, inside one by number; what no group names goes last.
  const numbers = topicRecord?.elementNumbers ?? {};
  let next = Math.max(0, ...Object.values(numbers), ...Object.values(topicRecord?.elementRetired ?? {})) + 1;
  const groups = topicRecord?.elementGroups ?? [];
  const groupOf = new Map(groups.flatMap((g, gi) => g.ids.map((id) => [id, gi])));
  for (const t of elements) {
    t.no = Number.isInteger(numbers[t.text]) ? numbers[t.text] : next++;
    const gi = groupOf.get(t.text);
    t.groupIndex = gi ?? groups.length;
    t.group = gi === undefined ? (groups.length ? "Другие" : "") : groups[gi].title;
  }
  elements.sort((a, b) => a.groupIndex - b.groupIndex || a.no - b.no);
  // not offered in the panel (`groups[].hidden`, tools/propis2/element_numbers.json; owner, 2026-11-21: the letters give them — «Штрихи»);
  // still in the list (`hidden`), only the picker leaves them out: the field's {эN} codes of the rows that have them, the ready notebooks
  const hiddenIds = new Set(groups.flatMap((g) => g.hidden ?? []));
  for (const t of elements) if (hiddenIds.has(t.text)) t.hidden = true;
  // a colour per group (owner, 2026-11-21: «Элементы» like «Штрихи» — the colours of Propis2PartsPad): its tiles' ink, number and heading
  for (const t of elements) t.color = GROUP_COLORS[t.groupIndex % GROUP_COLORS.length];
  // punctuation marks (wide.json kind "punct", and : ; – made in glyphOverrides.js), in the order of a sentence
  const marks = [".", ",", ":", ";", "–", "!", "?"].filter((m) => glyphMap.get(m)?.kind === "punct").map((m) => make("text", m, m));
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
    t.inRow = out.marks.includes(t) ? IN_ROW_MARKS.has(t.text) : staysInRow(t.box);
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
    // the look of the «Штрихи» pad (Propis2PartsPad): a white mat, the row's lines (red dashes: capitals, middle, tails; the top of the small
    // letters; the bold baseline), the slants; the element in its group's colour with a dot where the pen starts it
    const ink = tile.color ?? "#1d4ed8";
    const start = tile.strokes[0]?.match(/-?\d*\.?\d+/g)?.slice(0, 2).map(Number);
    return (
      <svg className="propis2-tile-glyph" width={size} height={Math.round((size * h) / w)} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true">
        <g stroke="#93a3b5" strokeOpacity="0.45" strokeWidth="0.45" fill="none">{slants}</g>
        <g fill="none">
          <line x1={x} x2={x + w} y1={WIDE_TOP} y2={WIDE_TOP} stroke="#e57d7a" strokeWidth="0.6" strokeDasharray="2.4 1.8" />
          <line x1={x} x2={x + w} y1={WIDE_BOTTOM} y2={WIDE_BOTTOM} stroke="#e57d7a" strokeWidth="0.6" strokeDasharray="2.4 1.8" />
          <line x1={x} x2={x + w} y1={ROW_TOP} y2={ROW_TOP} stroke="#55606c" strokeWidth="0.7" />
          <line x1={x} x2={x + w} y1={ROW_MID} y2={ROW_MID} stroke="#e57d7a" strokeWidth="0.6" strokeDasharray="2.4 1.8" />
          <line x1={x} x2={x + w} y1={ROW_BASE} y2={ROW_BASE} stroke="#2f3842" strokeWidth="1.3" />
        </g>
        {tile.strokes.map((d, i) => <path key={i} d={d} fill="none" stroke={ink} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />)}
        {start && start.length === 2 && <circle cx={start[0]} cy={start[1]} r={2.7} fill={ink} stroke="#fff" strokeWidth={0.9} />}
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
