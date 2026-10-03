import { useEffect, useMemo, useRef, useState } from "react";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { ROW_BASE, ROW_TOP, bboxOf, narrowStrokes, staysInRow } from "@/topics/renderers/propis2/glyphReach.js";

// Tiles of the vertical carousel: elements, lowercase and capital letters of the installed deck, each drawn
// with its own captured strokes (not a font), so the adult sees exactly what the child will write.
const LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
const UPPER = LOWER.toUpperCase();

export const CAROUSEL_TABS = [
  { id: "elements", label: "Элементы" },
  { id: "lower", label: "Строчные" },
  { id: "upper", label: "Заглавные" },
  { id: "marks", label: "Знаки" },
];

// Every tile shows a piece of the NARROW row (thin top line, dashed middle, bold baseline) with the symbol on
// it, all at the same scale: the symbol is the one the engine lays out on the narrow ruling (the same
// strokes, stretch and 0.5 scale as on the page), so a letter on a tile is exactly as big as on the sheet and
// tiles of different letters can be compared by eye.
const ROW_MID = (ROW_TOP + ROW_BASE) / 2;
const MAX_TILE_SYMBOL_W = 100;

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

export function TileGlyph({ tile, size = 56 }) {
  // word / text chips and anything without strokes: plain text
  if (!tile.strokes.length || !tile.frame) return <span className="propis2-chip-text" style={{ maxWidth: size * 3 }}>{tile.caption ?? tile.text}</span>;
  const { x, y, w, h } = tile.frame;
  const sw = 1.6; // ink width in row units
  return (
    <svg className="propis2-tile-glyph" width={size} height={Math.round((size * h) / w)} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true">
      <g stroke="#8a8f98" strokeWidth="0.6" fill="none">
        <line x1={x} x2={x + w} y1={ROW_TOP} y2={ROW_TOP} />
        <line x1={x} x2={x + w} y1={ROW_MID} y2={ROW_MID} strokeDasharray="2 1.4" />
        <line x1={x} x2={x + w} y1={ROW_BASE} y2={ROW_BASE} strokeWidth="1.2" stroke="#555" />
      </g>
      {tile.strokes.map((d, i) => <path key={i} d={d} fill="none" stroke="#1d4ed8" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

// Horizontal, endless carousel: the list is rendered three times and the scroll position is moved by one
// list width whenever it leaves the middle copy, so it never ends. A tile is dragged up onto the page
// (onDragStart with the pointer event), or tapped (onTap).
export default function Propis2Carousel({ topicRecord, onTap, onDragStart, side = false, ruling = "narrow" }) {
  const tiles = useMemo(() => buildTiles(topicRecord), [topicRecord]);
  const [pickedTab, setTab] = useState("lower");
  const listRef = useRef(null);
  // wide ruling: only symbols that stay inside the row (no capitals, no б в д з р у ф ц щ, no ! ?); elements are all there
  const wide = ruling === "wide";
  const tabs = CAROUSEL_TABS.filter((t) => !(wide && t.id === "upper"));
  const tab = tabs.some((t) => t.id === pickedTab) ? pickedTab : "lower";
  const items = (tiles[tab] ?? []).filter((t) => !wide || tab === "elements" || t.inRow);
  const copies = !side && items.length > 6 ? 3 : 1; // side panel: a plain scrolling grid, no loop

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollLeft = copies === 3 ? el.scrollWidth / 3 : 0;
  }, [tab, copies, items.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el || copies !== 3) return;
    const w = el.scrollWidth / 3;
    if (!(w > 0)) return;
    if (el.scrollLeft < w * 0.5) el.scrollLeft += w;
    else if (el.scrollLeft > w * 1.5) el.scrollLeft -= w;
  };

  return (
    <div className={`propis2-carousel${side ? " propis2-carousel--grid" : ""}`} data-testid="propis2-carousel">
      <div className="propis2-carousel-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`propis2-carousel-tab${tab === t.id ? " is-on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="propis2-carousel-list" ref={listRef} onScroll={onScroll}>
        {Array.from({ length: copies }, (_, c) => items.map((tile) => (
          <button
            key={`${c}-${tile.key}`}
            type="button"
            className="propis2-tile"
            data-tile={tile.text}
            aria-label={`${tile.caption}: перетащите на строку или нажмите`}
            onPointerDown={(e) => onDragStart(tile, e)}
            onClick={(e) => { if (e.detail === 0) onTap(tile); }}
            onDragStart={(e) => e.preventDefault()}
          >
            <TileGlyph tile={tile} size={72} />
          </button>
        )))}
      </div>
    </div>
  );
}
