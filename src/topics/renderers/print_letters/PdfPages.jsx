import Sheet from "./Sheet";
import LetterGlyph from "./LetterGlyph";
import { PlateWords } from "./WordBlock";
import { isWordBlock } from "./words";
import { FORMATS, PAGE_MARGIN_MM, sheetSizeMm } from "./model";
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
    return <Sheet key={p.id} page={p} format={format} byId={byId} className="pl-sheet--print" nameLine={nameLine} pageNo={opts.numbers ? k + 1 : null} />;
  };
  const cover = opts.cover ? <CoverSheet notebook={notebook} byId={byId} format={format} /> : null;

  const pdfPages = [];
  if (format === "a4") {
    const { w, h } = FORMATS.a4;
    const one = (node) => ({ w, h, slots: [{ x: PAGE_MARGIN_MM, y: PAGE_MARGIN_MM, node }] });
    if (cover) pdfPages.push(one(cover), one(null));
    for (let k = 0; k < count; k++) pdfPages.push(one(pageNode(k)));
  } else {
    const W = FORMATS.a4.h, H = FORMATS.a4.w, half = W / 2; // A4 landscape, two A5 slots
    const two = (left, right) => ({ w: W, h: H, slots: [{ x: PAGE_MARGIN_MM, y: PAGE_MARGIN_MM, node: left }, { x: half + PAGE_MARGIN_MM, y: PAGE_MARGIN_MM, node: right }] });
    if (cover) pdfPages.push(two(null, cover), two(null, null));
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

// The cover: «Печатные буквы», the notebook's letters and words on a big plate in the topic's style,
// its title, and a line for the child's name. On white (no grid), the sheet's size.
function CoverSheet({ notebook, byId, format }) {
  const { w, h } = sheetSizeMm(format);
  const blocks = notebook.pages.flatMap((p) => p.blocks);
  const letters = [...new Set(blocks.filter((b) => !isWordBlock(b)).map((b) => b.letterId))].filter((id) => byId[id]);
  const words = [...new Set(blocks.filter(isWordBlock).flatMap((b) => b.words ?? []))];
  const k = format === "a5" ? 0.7 : 1; // A5 is 0.7 of A4
  const glyphH = ((letters.length || words.length) > 8 ? 13 : 20) * k;
  return (
    <div className="pl-sheet pl-sheet--print pl-sheet--cover" style={{ width: `${w}mm`, height: `${h - 1}mm`, padding: `${16 * k}mm ${14 * k}mm` }}>
      {/* written in capitals here, not by text-transform: the PDF draws the text it finds in the page */}
      <div className="pl-cover-kicker" style={{ fontSize: `${13 * k}pt` }}>ПЕЧАТНЫЕ БУКВЫ</div>
      <div className="pl-cover-plate" style={{ borderRadius: `${8 * k}mm 0 ${8 * k}mm 0`, padding: `${10 * k}mm`, gap: `${6 * k}mm ${7 * k}mm`, minHeight: `${70 * k}mm` }}>
        {/* the notebook's letters; its syllables and words only when it has no letter blocks */}
        {letters.slice(0, 12).map((id) => <LetterGlyph key={id} letter={byId[id]} heightMm={glyphH} variant="plain" color="#ffffff" weight={13} />)}
        {!letters.length && words.slice(0, 6).map((word) => <PlateWords key={word} words={[word]} byId={byId} heightMm={glyphH} color="#ffffff" weight={13} />)}
      </div>
      <div className="pl-cover-title" style={{ fontSize: `${24 * k}pt` }}>{notebook.title?.trim() || "Тетрадь"}</div>
      <div className="pl-cover-fill" />
      <div className="pl-cover-name" style={{ fontSize: `${13 * k}pt`, gap: `${3 * k}mm` }}>
        <span>Имя</span><span className="pl-cover-line" style={{ width: `${90 * k}mm` }} />
      </div>
    </div>
  );
}
