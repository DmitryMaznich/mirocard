import Sheet from "./Sheet";
import LetterGlyph from "./LetterGlyph";
import { isWordBlock } from "./words";
import { FORMATS, PAGE_MARGIN_MM, sheetSizeMm } from "./model";
import { MIRONIUM_HEAD } from "./brand";
import { bookletBlocked, bookletPageCount, bookletSheets } from "./booklet";

// The notebook laid out on the PAPER of the PDF (owner, 2026-11-03: «модалку… номера страниц,
// обложка, тетрадью или всплошную, как в Прописях»; propis2's Propis2PrintDialog + booklet.js):
//  - А4 — one page per A4 sheet, in order; the cover first, then its blank back (for two-sided print);
//  - А5 «По порядку» — two pages to an A4 landscape sheet, to cut in half; the cover on the right half
//    of the first sheet (its back, blank, on the left), then a blank sheet (the cover's inside);
//  - А5 «Тетрадью» — saddle-stitch booklet order: the pages padded to a multiple of 4 with empty pages
//    of the same paper, each A4 sheet printed on both sides (flip on the short edge), folded and
//    stapled; the cover is its own outer sheet. Up to BOOKLET_MAX_PAGES pages.
// Each PDF page is a `.pl-pdf-page` (data-w/-h in mm) with `.pl-pdf-slot`s (data-x/-y/-w/-h: where a
// sheet goes on it); the app's printLettersPdf.js turns them into PDF pages as they are.
export default function PdfPages({ notebook, byId, opts, containerRef }) {
  const format = notebook.format ?? "a4";
  const sheet = sheetSizeMm(format);
  const nameLine = notebook.nameLine !== false;
  const booklet = opts.booklet && !bookletBlocked(notebook);
  const count = booklet ? bookletPageCount(notebook.pages.length) : notebook.pages.length;
  const lastPaper = notebook.pages[notebook.pages.length - 1]?.paper ?? "cell";
  // content page k (0-based): a notebook page, or a padding page of «Тетрадью»
  const pageNode = (k) => {
    const p = notebook.pages[k] ?? { id: `pad-${k}`, paper: lastPaper, blocks: [] };
    return <Sheet key={p.id} page={p} format={format} byId={byId} className="pl-sheet--print" nameLine={nameLine} pageNo={opts.numbers ? k + 1 : null} brand />;
  };
  const cover = opts.cover ? <CoverFront notebook={notebook} byId={byId} format={format} /> : null;
  const back = opts.cover ? <CoverBack byId={byId} format={format} /> : null;

  const pdfPages = [];
  if (format === "a4") {
    const { w, h } = FORMATS.a4;
    const one = (node) => ({ w, h, slots: [{ x: PAGE_MARGIN_MM, y: PAGE_MARGIN_MM, node }] });
    if (cover) pdfPages.push(one(cover), one(back)); // the back cover is the front's reverse
    for (let k = 0; k < count; k++) pdfPages.push(one(pageNode(k)));
  } else {
    const W = FORMATS.a4.h, H = FORMATS.a4.w, half = W / 2; // A4 landscape, two A5 slots
    const two = (left, right) => ({ w: W, h: H, slots: [{ x: PAGE_MARGIN_MM, y: PAGE_MARGIN_MM, node: left }, { x: half + PAGE_MARGIN_MM, y: PAGE_MARGIN_MM, node: right }] });
    if (cover) pdfPages.push(two(back, cover), two(null, null)); // back | front on the outside, blank inside
    if (booklet) {
      for (const s of bookletSheets(notebook.pages.length)) {
        pdfPages.push(two(pageNode(s.front[0]), pageNode(s.front[1])), two(pageNode(s.back[0]), pageNode(s.back[1])));
      }
    } else {
      for (let k = 0; k < count; k += 2) pdfPages.push(two(pageNode(k), k + 1 < count ? pageNode(k + 1) : null));
    }
  }

  return (
    <div ref={containerRef} className="pl-print-pages pl-print-pages--export" aria-hidden="true">
      {pdfPages.map((pp, i) => (
        <div key={i} className="pl-pdf-page" data-w={pp.w} data-h={pp.h}>
          {pp.slots.map((s, j) => (
            <div key={j} className="pl-pdf-slot" data-x={s.x} data-y={s.y} data-w={sheet.w} data-h={sheet.h}>{s.node}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- the cover (owner, 2026-11-03: «более крутой шаблон… современно и видно, что это рабочая тетрадь»;
// the back: the printed alphabet and the logo). No options. Laid out in A4 millimetres, scaled ×0.7 for
// A5 (`u`). Only what the PDF walker draws: text, background colours, borders, SVGs (the grid is an SVG).
const COVER_COLORS = ["#e8702a", "#2f8fd1", "#b5257a", "#3aa655", "#d1a62f", "#7a52c9"];
const FAMILY_COLORS = { straight: "#2a6b60", slant: "#2f6fb8", oval: "#a3245f" };
const FAMILY_NAMES = { straight: "прямые линии", slant: "наклонные", oval: "овалы" };
const INK = "#1f3a8a";

const scaleOf = (format) => (format === "a5" ? 0.7 : 1);

// A piece of notebook grid, `cols` × `rows` cells of `cell` mm.
function GridSvg({ cols, rows, cell, color = "#cfe0ef" }) {
  const w = cols * cell, h = rows * cell;
  let d = "";
  for (let i = 0; i <= cols; i++) d += `M${i * cell} 0V${h}`;
  for (let j = 0; j <= rows; j++) d += `M0 ${j * cell}H${w}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={`${w}mm`} height={`${h}mm`} style={{ width: `${w}mm`, height: `${h}mm`, position: "absolute", left: 0, top: 0 }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={0.25} />
    </svg>
  );
}

function CoverFront({ notebook, byId, format }) {
  const { w, h } = sheetSizeMm(format);
  const k = scaleOf(format);
  const u = (v) => `${v * k}mm`;
  const blocks = notebook.pages.flatMap((p) => p.blocks);
  const letters = [...new Set(blocks.filter((b) => !isWordBlock(b)).map((b) => b.letterId))].filter((id) => byId[id]);
  const fromWords = [...new Set(blocks.filter(isWordBlock).flatMap((b) => [...(b.words ?? []).join("")]))].filter((id) => byId[id]);
  const shown = (letters.length ? letters : fromWords).slice(0, 4);
  const first = byId[shown[0]] ?? byId["А"] ?? Object.values(byId)[0];
  const cell = 5 * k;
  const heroCols = Math.floor((w - 28 * k) / cell);
  const sampleLetter = first ? { ...first, strokes: first.strokes.map((st, i) => ({ ...st, n: i + 1 })) } : null;
  const lw = first ? (first.wide ? 4 / 3 : 1) * 6 * cell : 0; // the writing row: letters 6 cells tall
  return (
    <div className="pl-sheet pl-sheet--print pl-sheet--cover" style={{ width: `${w}mm`, height: `${h - 1}mm`, padding: `${u(14)} ${u(14)} 0`, gap: 0, alignItems: "stretch" }}>
      <div className="pl-cv-kicker" style={{ fontSize: `${10.5 * k}pt` }}>РАБОЧАЯ ТЕТРАДЬ</div>
      <div className="pl-cv-title" style={{ fontSize: `${40 * k}pt`, marginTop: u(3) }}>Печатные буквы</div>
      <div className="pl-cv-sub" style={{ fontSize: `${16 * k}pt`, marginTop: u(2) }}>{notebook.title?.trim() || "Тетрадь"}</div>
      <div className="pl-cv-hero" style={{ height: `${21 * cell}mm`, marginTop: u(10) }}>
        <GridSvg cols={heroCols} rows={21} cell={cell} />
        {/* the notebook's letters on plates, like the blocks' plates */}
        {shown.map((id, i) => (
          <div key={id} className="pl-cv-plate" style={{ left: `${(1 + i * 9) * cell}mm`, top: `${cell}mm`, width: `${8 * cell}mm`, height: `${8 * cell}mm`, background: COVER_COLORS[i % COVER_COLORS.length], borderRadius: `${u(4)} 0 ${u(4)} 0`, paddingTop: `${2 * cell}mm` }}>
            <LetterGlyph letter={byId[id]} heightMm={4 * cell} variant="plain" color="#ffffff" weight={13} />
          </div>
        ))}
        {/* a writing row: the sample with its dots, arrows and numbers, then contours to trace */}
        {sampleLetter && [0, 1, 2, 3].map((i) => (
          <div key={i} style={{ position: "absolute", left: `${(1 + i * 9) * cell}mm`, top: `${12 * cell}mm` }}>
            <LetterGlyph letter={sampleLetter} heightMm={6 * cell} widthMm={lw} variant={i === 0 ? "sample" : "dotted"} dots={i < 2} opacity={i === 3 ? 0.45 : 1} />
          </div>
        ))}
      </div>
      <div className="pl-cover-fill" />
      <div className="pl-cv-fields" style={{ marginBottom: u(6), padding: `${u(6)} ${u(8)}`, gap: u(6), borderRadius: u(4) }}>
        {/* two blank write-in lines, no labels (owner, 2026-11-03) */}
        {[0, 1].map((i) => (
          <div key={i} className="pl-cv-field" style={{ height: u(9) }}>
            <span className="pl-cv-line" />
          </div>
        ))}
      </div>
      {/* the logo, small, centred at the foot of the front (owner, 2026-11-05; as propis2's cover) */}
      <div className="pl-cv-brand" style={{ gap: u(2), marginBottom: u(5) }}>
        <svg viewBox="0 0 420 440" width={u(6)} height={u(6.3)} style={{ width: u(6), height: u(6.3) }} aria-hidden="true">
          <path d={MIRONIUM_HEAD} fill="#2a6b60" />
        </svg>
        <span className="pl-cv-brand-name" style={{ fontSize: `${12 * k}pt` }}>Mironium</span>
      </div>
      <div className="pl-cv-stripes" style={{ height: u(5), marginLeft: `-${u(14)}`, marginRight: `-${u(14)}` }}>
        {COVER_COLORS.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
      </div>
    </div>
  );
}

function CoverBack({ byId, format }) {
  const { w, h } = sheetSizeMm(format);
  const k = scaleOf(format);
  const u = (v) => `${v * k}mm`;
  const ALPHA = [..."АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"].filter((ch) => byId[ch]);
  const cell = 5 * k;
  const cols = 6;
  const boxW = Math.floor((w - 28 * k) / cell / cols); // cells per letter box
  const rowsN = Math.ceil(ALPHA.length / cols);
  const boxH = 6; // cells
  return (
    <div className="pl-sheet pl-sheet--print pl-sheet--cover" style={{ width: `${w}mm`, height: `${h - 1}mm`, padding: `${u(14)} ${u(14)} 0`, gap: 0, alignItems: "stretch" }}>
      <div className="pl-cv-kicker" style={{ fontSize: `${10.5 * k}pt` }}>ПЕЧАТНЫЙ АЛФАВИТ</div>
      <div className="pl-cv-hero" style={{ height: `${rowsN * boxH * cell + cell}mm`, marginTop: u(6) }}>
        <GridSvg cols={cols * boxW} rows={rowsN * boxH + 1} cell={cell} color="#dce8f3" />
        {ALPHA.map((ch, i) => {
          const l = byId[ch];
          const lw = (l.wide ? 4 / 3 : 1) * 4 * cell;
          return (
            <div key={ch} style={{ position: "absolute", left: `${((i % cols) * boxW + Math.floor((boxW - (l.wide ? 3 : 2)) / 2)) * cell}mm`, top: `${(Math.floor(i / cols) * boxH + 1) * cell}mm` }}>
              <LetterGlyph letter={l} heightMm={4 * cell} widthMm={lw} variant="plain" color={FAMILY_COLORS[l.family] ?? INK} weight={9} label={ch} />
            </div>
          );
        })}
      </div>
      <div className="pl-cv-legend" style={{ marginTop: u(5), gap: u(6), fontSize: `${10 * k}pt` }}>
        {Object.entries(FAMILY_NAMES).map(([id, name]) => (
          <span key={id} className="pl-cv-legend-item" style={{ gap: u(2) }}>
            <span className="pl-cv-dot" style={{ width: u(3), height: u(3), background: FAMILY_COLORS[id] }} />{name}
          </span>
        ))}
      </div>
      <div className="pl-cover-fill" />
      <div className="pl-cv-brand" style={{ gap: u(3), marginBottom: u(10) }}>
        <svg viewBox="0 0 420 440" width={u(10)} height={u(10.5)} style={{ width: u(10), height: u(10.5) }} aria-hidden="true">
          <path d={MIRONIUM_HEAD} fill="#2a6b60" />
        </svg>
        <span className="pl-cv-brand-name" style={{ fontSize: `${17 * k}pt` }}>Mironium</span>
        <span className="pl-cv-brand-url" style={{ fontSize: `${10 * k}pt` }}>mironium.com</span>
      </div>
      <div className="pl-cv-stripes" style={{ height: u(5), marginLeft: `-${u(14)}`, marginRight: `-${u(14)}` }}>
        {COVER_COLORS.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
      </div>
    </div>
  );
}
