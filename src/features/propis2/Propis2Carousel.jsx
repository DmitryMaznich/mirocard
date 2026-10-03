import { useEffect, useMemo, useRef, useState } from "react";
import { layoutWideLinesIntoRows } from "@/topics/renderers/propis/wordEngine.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { NATIVE_L3, TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET } from "@/topics/renderers/propis/propisRuling.js";

// Tiles of the vertical carousel: elements, lowercase and capital letters of the installed deck, each drawn
// with its own captured strokes (not a font), so the adult sees exactly what the child will write.
const LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
const UPPER = LOWER.toUpperCase();

export const CAROUSEL_TABS = [
  { id: "elements", label: "Элементы" },
  { id: "lower", label: "Строчные" },
  { id: "upper", label: "Заглавные" },
];

// Every tile shows a piece of the NARROW row (thin top line, dashed middle, bold baseline) with the symbol on
// it, all at the same scale: the symbol is the one the engine lays out on the narrow ruling (the same
// strokes, stretch and 0.5 scale as on the page), so a letter on a tile is exactly as big as on the sheet and
// tiles of different letters can be compared by eye.
const NARROW_SCALE = 0.5;
const ROW_BASE = NATIVE_L3 - TEXT_ROW_THIN_OFFSET; // row-local baseline of the narrow band (64)
const ROW_TOP = ROW_BASE - (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET) * NARROW_SCALE; // thin top line (40)
const ROW_MID = (ROW_TOP + ROW_BASE) / 2;
const MAX_TILE_SYMBOL_W = 100;

function bbox(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of strokes) {
    const nums = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

export function buildTiles(topicRecord) {
  const glyphMap = buildGlyphMap(topicRecord);
  const strokesOf = (label) => {
    try {
      const { placed } = layoutWideLinesIntoRows([label], glyphMap, undefined, false, NARROW_SCALE);
      return (placed[0]?.segments?.[0]?.trajectory?.strokes ?? []).map((st) => st.d).filter(Boolean);
    } catch {
      return [];
    }
  };
  const wide = topicRecord?.wide ?? [];
  const byLabel = new Map(wide.map((g) => [g.label, g]));
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
  const out = { elements, lower: letters(LOWER), upper: letters(UPPER) };

  // One frame for all tiles: tall enough for the highest ascender and the deepest descender of any symbol, wide
  // enough for the widest one, so every tile has the same size and the row stands at the same place in it.
  const all = [...out.elements, ...out.lower, ...out.upper];
  let top = ROW_TOP - 4, bottom = ROW_BASE + 6, width = 40;
  for (const t of all) {
    t.box = bbox(t.strokes);
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
export default function Propis2Carousel({ topicRecord, onTap, onDragStart, side = false }) {
  const tiles = useMemo(() => buildTiles(topicRecord), [topicRecord]);
  const [tab, setTab] = useState("lower");
  const listRef = useRef(null);
  const items = tiles[tab] ?? [];
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
        {CAROUSEL_TABS.map((t) => (
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
