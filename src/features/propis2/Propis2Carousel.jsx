import { useEffect, useMemo, useRef, useState } from "react";
import { layoutWideLinesIntoRows } from "@/topics/renderers/propis/wordEngine.js";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";

// Tiles of the vertical carousel: elements, lowercase and capital letters of the installed deck, each drawn
// with its own captured strokes (not a font), so the adult sees exactly what the child will write.
const LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
const UPPER = LOWER.toUpperCase();

export const CAROUSEL_TABS = [
  { id: "elements", label: "Элементы" },
  { id: "lower", label: "Строчные" },
  { id: "upper", label: "Заглавные" },
];

// The engine draws every captured wide glyph stretched horizontally (wide.json `stretch`, 1.806 for letters,
// slant kept: x' = a*x - (a-1)*tan(25°)*(62 - y), the same formula as stretchKeepSlantPathD). The tiles must show
// that same shape, or the letters look squeezed from the sides.
const SLANT_TAN = Math.tan((25 * Math.PI) / 180);
const CAPTURE_BASELINE = 62;
function stretchPath(d, a) {
  if (!a || a === 1) return d;
  const nums = d.match(/-?\d*\.?\d+/g) ?? [];
  let k = 0;
  return d.replace(/-?\d*\.?\d+/g, () => {
    const i = k;
    k += 1;
    const pairStart = i - (i % 2);
    const x = Number(nums[pairStart]);
    const y = Number(nums[pairStart + 1]);
    if (i % 2 === 1) return String(y);
    return String(Number((a * x - (a - 1) * SLANT_TAN * (CAPTURE_BASELINE - y)).toFixed(3)));
  });
}
const strokesOf = (g, stretch = g?.stretch ?? 1) => (g?.strokes ?? []).map((s) => stretchPath(s.d, stretch)).filter(Boolean);

export function buildTiles(topicRecord) {
  const wide = topicRecord?.wide ?? [];
  const byLabel = new Map(wide.map((g) => [g.label, g]));
  // Composite letters (ш, ы…) have no strokes of their own: the engine assembles them, so the tile takes the
  // assembled strokes (already stretched) from a one-letter layout.
  let glyphMap = null;
  const assembled = (label) => {
    try {
      glyphMap ??= buildGlyphMap(topicRecord);
      const { placed } = layoutWideLinesIntoRows([label], glyphMap, undefined, false, 1);
      return (placed[0]?.segments?.[0]?.trajectory?.strokes ?? []).map((st) => st.d).filter(Boolean);
    } catch {
      return [];
    }
  };
  const letters = (alphabet) => [...alphabet].map((ch) => byLabel.get(ch)).filter(Boolean)
    .map((g) => {
      const own = strokesOf(g);
      return { key: g.label, kind: "text", text: g.label, caption: g.label, strokes: own.length ? own : assembled(g.label) };
    });
  const seen = new Set();
  const elements = [];
  for (const g of wide) {
    if (g.kind !== "element" || seen.has(g.label)) continue;
    seen.add(g.label);
    elements.push({ key: g.label, kind: "element", text: g.label, caption: g.label, strokes: strokesOf(g) });
  }
  for (const el of topicRecord?.elements ?? []) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);
    elements.push({ key: el.id, kind: "element", text: el.id, caption: el.labelRu ?? el.id, strokes: strokesOf(el, 1.806) });
  }
  return { elements, lower: letters(LOWER), upper: letters(UPPER) };
}

// viewBox that frames the strokes: bbox of every coordinate pair in the path data, plus a margin.
function frame(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of strokes) {
    const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
    }
  }
  if (!Number.isFinite(minX)) return { vb: "0 0 10 10", sw: 1 };
  const size = Math.max(maxX - minX, maxY - minY, 20);
  const pad = size * 0.12;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  return { vb: `${minX - pad} ${minY - pad} ${w} ${h}`, sw: size * 0.05 };
}

export function TileGlyph({ tile, size = 56 }) {
  const { vb, sw } = useMemo(() => frame(tile.strokes), [tile]);
  // word / text chips have no strokes: they are drawn as plain text
  if (!tile.strokes.length) return <span className="propis2-chip-text" style={{ maxWidth: size * 3 }}>{tile.caption ?? tile.text}</span>;
  return (
    <svg className="propis2-tile-glyph" width={size} height={size} viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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
            <TileGlyph tile={tile} size={46} />
          </button>
        )))}
      </div>
    </div>
  );
}
