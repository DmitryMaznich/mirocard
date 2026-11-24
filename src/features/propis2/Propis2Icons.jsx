import SH from "./iconShapes.json";
import { FOUR_LINE_PAPERS } from "@/handwriting/fourLinePapers.js";

// Pictograms of the `propis2` constructor. Every control of the constructor is an icon (no visible text; the name of a
// control is its aria-label for screen readers). 24x24, drawn with currentColor so a button decides the colour.
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
const S = (children) => <svg {...base}>{children}</svg>;

// Pictograms of the paper and of the rows are three-coloured: what is WRITTEN in ink (currentColor: the letter «а», the element
// «крючок», taken from the topic's own data, see tools/propis2/build_icon_shapes.py), the ruling grey, the guide lines, the start dots
// and the margin red (as on the page). The actions (add, copy, delete, arrows...) stay one colour.
const GRAY = "#9aa3af";
const DARK = "#4b5563";
const RED = "#dc2626";
const rule = (y, x1 = 2.5, x2 = 21.5) => <path d={`M${x1} ${y}H${x2}`} stroke={GRAY} strokeWidth={1.1} />;
const baseRule = (y, x1 = 2.5, x2 = 21.5) => <path d={`M${x1} ${y}H${x2}`} stroke={DARK} strokeWidth={1.6} />;
const guide = (y, x1 = 2.5, x2 = 21.5) => <path d={`M${x1} ${y}H${x2}`} stroke={RED} strokeWidth={1.2} strokeDasharray="1.5 1.7" />;
const shape = (name, x = 0, y = 0, props = {}) => <g transform={`translate(${x} ${y})`} {...props}>{SH[name].d.map((d, i) => <path key={i} d={d} />)}</g>;
const slants = (xs, y1, y2) => xs.map((x) => <path key={x} d={`M${x} ${y1}L${x - (y2 - y1) * 0.466} ${y2}`} stroke={GRAY} strokeWidth={1} />);

// ---- paper kinds -------------------------------------------------------------------------------------------------------
export const IconPaperSquare = () => S(<><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" stroke={GRAY} strokeWidth={1.2} /><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" stroke={GRAY} strokeWidth={1.1} /></>);
// the Bulgarian copybook ruling: bold - thin - thin - bold, a steep guide
export const IconPaperBg = () => S(<><path d="M14 4L10 20" stroke={GRAY} strokeWidth={1} />{baseRule(4)}{rule(10, 3, 21)}{rule(14, 3, 21)}{baseRule(20)}</>);
// A three- or four-line paper (fourLinePapers.js): ONE row of it, its lines as the paper draws them (top / x-line / baseline / bottom:
// thin, dashed, bold or none), a dimension arrow over the lowercase band and its height in mm — the way the Russian rows are told
// apart (mmRow below; owner, 2026-11-24: «в русских мы сделали цифру… ни в славянской, ни в британской таких обозначений не делали»,
// the British papers all had the Bulgarian icon, the Slovene ones only differed by how many rows fit). Drawn to one scale per family
// of papers (the Slovene ones together, the British ones together), so a larger paper is also a taller row.
const fourLineIcons = new Map();
const familyOf = (id) => (id.startsWith("en_") ? id.split("_").slice(0, 2).join("_") : id.split("_")[0]);
const rowMm = (p) => p.upMm + p.xMm + p.downMm;
const mmText = (mm) => (Number.isInteger(mm) ? String(mm) : String(Math.round(mm * 10) / 10).replace(".", ","));
export const fourLinePaperIcon = (id, p) => {
  if (fourLineIcons.has(id)) return fourLineIcons.get(id);
  const family = Object.entries(FOUR_LINE_PAPERS).filter(([pid]) => familyOf(pid) === familyOf(id)).map(([, q]) => rowMm(q));
  const k = 19 / Math.max(rowMm(p), ...family);
  const top = 12 - (rowMm(p) * k) / 2;
  const ys = { top, x: top + p.upMm * k, base: top + (p.upMm + p.xMm) * k, bottom: top + rowMm(p) * k };
  const kinds = { top: "thin", x: "dash", base: "bold", bottom: "thin", ...(p.lines ?? {}) };
  const line = (which) => {
    const y = ys[which];
    if (kinds[which] === "none") return null;
    if (kinds[which] === "dash") return <path key={which} d={`M2.5 ${y}H13`} stroke={GRAY} strokeWidth={1.1} strokeDasharray="1.6 1.4" />;
    if (kinds[which] === "bold") return <path key={which} d={`M2.5 ${y}H13`} stroke={DARK} strokeWidth={1.6} />;
    return <path key={which} d={`M2.5 ${y}H13`} stroke={GRAY} strokeWidth={1.1} />;
  };
  const t = mmText(p.xMm);
  const head = Math.min(1.6, (ys.base - ys.x) / 3);
  const Icon = () => S(<>
    {["top", "x", "base", "bottom"].map(line)}
    <path d={`M14.8 ${ys.x}V${ys.base}M${14.8 - head * 0.6} ${ys.x + head}L14.8 ${ys.x}L${14.8 + head * 0.6} ${ys.x + head}M${14.8 - head * 0.6} ${ys.base - head}L14.8 ${ys.base}L${14.8 + head * 0.6} ${ys.base - head}`} stroke={DARK} strokeWidth={1} />
    <text x={t.length > 1 ? 20.3 : 19.9} y={(ys.x + ys.base) / 2 + (t.length > 1 ? 2.8 : 3.3)} textAnchor="middle" fontSize={t.length > 2 ? 5.6 : t.length > 1 ? 7.6 : 9.5} fontWeight="700" fontFamily="system-ui, sans-serif" fill={DARK} stroke="none">{t}</text>
  </>);
  Icon.displayName = `IconPaper_${id}`;
  fourLineIcons.set(id, Icon);
  return Icon;
};
// the print style's papers (src/handwriting/printPapers.js): the 5 mm cell with a letter-tall band, the 1 cm cell, the 1 cm rows with the
// letter's height dashed and a gap between them
export const IconPaperPrintCell = () => S(<><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" stroke={GRAY} strokeWidth={1.2} /><path d="M7.75 3.5v17M12 3.5v17M16.25 3.5v17M3.5 7.75h17M3.5 12h17M3.5 16.25h17" stroke={GRAY} strokeWidth={0.8} /><path d="M7.75 7.75v8.5M10 7.75v8.5" stroke={DARK} strokeWidth={1.4} /></>);
export const IconPaperPrintBigCell = () => S(<><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" stroke={GRAY} strokeWidth={1.2} /><path d="M12 3.5v17M3.5 12h17" stroke={GRAY} strokeWidth={1.1} /><path d="M5.5 5v5M5.5 5h3" stroke={DARK} strokeWidth={1.4} /></>);
export const IconPaperPrintLine = () => S(<><path d="M2.5 5H21.5M2.5 14H21.5" stroke={GRAY} strokeWidth={1} strokeDasharray="1.6 1.4" />{baseRule(10)}{baseRule(19)}</>);
export const IconPaperRuled = () => S(<>{rule(7, 3, 21)}{rule(12, 3, 21)}{rule(17, 3, 21)}<path d="M6 3.5v17" stroke={RED} strokeWidth={1.3} /></>);

// ---- row size (the letter «а» on its ruling), slant density, dashes, writing space ---------------------------------------
// A row ruling as a teacher knows it (owner, 2026-11-05): the band only — the thin top line, the bold baseline, the red dashed middle
// between them, a dimension arrow and the band's height in mm, drawn to one scale for all (2 px = 1 mm): 4 (the narrow row), 5 (Mazina
// step 2), 8 (the wide row, Mazina step 1: the same band, so the same pictogram).
const mmRow = (bandMm) => function MmRowIcon() {
  const h = bandMm * 2;
  const top = (24 - h) / 2;
  const base = top + h;
  const head = Math.min(2, h / 3);
  return S(<>
    {rule(top, 2.5, 13)}
    {guide(top + h / 2, 2.5, 13)}
    {baseRule(base, 2.5, 13)}
    <path d={`M14.8 ${top}V${base}M${14.8 - head * 0.6} ${top + head}L14.8 ${top}L${14.8 + head * 0.6} ${top + head}M${14.8 - head * 0.6} ${base - head}L14.8 ${base}L${14.8 + head * 0.6} ${base - head}`} stroke={DARK} strokeWidth={1} />
    <text x="19.9" y="15.4" textAnchor="middle" fontSize="9.5" fontWeight="700" fontFamily="system-ui, sans-serif" fill={DARK} stroke="none">{bandMm}</text>
  </>);
};
export const IconRowNarrow = mmRow(4);
export const IconRowWide = mmRow(8);
export const IconPaperM1 = mmRow(8);
export const IconPaperM2 = mmRow(5);
export const IconSlantSparse = () => S(<>{slants([11, 21], 4, 20)}{baseRule(20)}</>);
export const IconSlantNone = () => S(<>{slants([15], 4, 20)}{baseRule(20)}<path d="M5 5L19 19" stroke={DARK} strokeWidth={1.4} /></>);
export const IconSlantDense = () => S(<>{slants([7, 11, 15, 19, 23], 4, 20)}{baseRule(20)}</>);
// «Подсветка»: the narrow row with its band tinted `color` (a tint deepened for the 24 px pictogram, else it is not seen); none: a slash
export const IconBandFill = ({ color = null }) => S(<>{color && <rect x="2.5" y="6" width="19" height="12" fill={color} stroke="none" />}{rule(6)}{baseRule(18)}{!color && <path d="M6 21L18 3" stroke={GRAY} strokeWidth={1.4} />}</>);
export const IconDash = () => S(<>{rule(6)}{guide(12)}{baseRule(18)}</>);
export const IconWriteAfter = () => S(<>{baseRule(10.5)}{shape("a_narrow", 4, -5.5)}{baseRule(20, 2.5, 13)}<path d="M15.5 21l1.1-3.9 3.6-3.6 2.1 2.1-3.6 3.6z" strokeWidth={1.4} /></>);

// ---- page actions -------------------------------------------------------------------------------------------------------
export const IconPlay = () => S(<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" /></>);

// ---- row tools ---------------------------------------------------------------------------------------------------------
export const IconUp = () => S(<><path d="M12 19V5M6 11l6-6 6 6" /></>);
export const IconDown = () => S(<><path d="M12 5v14M6 13l6 6 6-6" /></>);
export const IconDuplicate = () => S(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></>);
// a clipboard with lines of text: «Вставить» (paste the copied text)
export const IconPaste = () => S(<><path d="M9 4.5H7a2 2 0 00-2 2V19a2 2 0 002 2h10a2 2 0 002-2V6.5a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="3.5" rx="1" /><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" /></>);
export const IconTrash = () => S(<><path d="M4 7h16M10 7V4.5h4V7M6.5 7l1 13h9l1-13" /><path d="M10 11v6M14 11v6" /></>);
export const IconWarn = () => S(<><path d="M12 3.5L2.8 19.5h18.4z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></>);

// ---- the element «крючок» and its copies, for the row options below ----------------------------------------------------------
const hook = (x, props) => shape("hook", x, 0, props);
const copy = { strokeDasharray: "1.4 2", stroke: "#6b7280", strokeWidth: 1.5 };
const STEP = 7;

// ---- row options: repeat (the element «крючок» and its copies: dashed, pale solid, fading), start dots ---------------------------------------
export const IconRepOne = () => S(<>{rule(18)}{hook(3)}</>);
export const IconRepAll = () => S(<>{rule(18)}{hook(2)}{hook(2 + STEP, copy)}{hook(2 + 2 * STEP, copy)}</>);
export const IconRepFade = () => S(<>{rule(18)}{hook(2)}{hook(2 + STEP, { ...copy, opacity: 0.55 })}{hook(2 + 2 * STEP, { ...copy, opacity: 0.22 })}</>);
// (owner, 2026-11-22) the start-dot icons are the capital print «А» — three strokes — as the sample, a dashed copy after it, and the red
// dots where the sheet puts them: the left slant starts at the bottom left, the right one at the apex, the bar at its left end.
// Proportions of the letter's own glyph (tools/handwriting/cyrillic/print.json): 2/3 as wide as tall, the bar at 0.4 of the height.
const A_H = 13, A_W = A_H * (69.332 / 104), A_BASE = 19, A_BAR = A_BASE - A_H * (41.6 / 104);
const aStrokes = (x) => [
  [[x, A_BASE], [x + A_W / 2, A_BASE - A_H]],
  [[x + A_W / 2, A_BASE - A_H], [x + A_W, A_BASE]],
  [[x + A_W * 0.2, A_BAR], [x + A_W * 0.8, A_BAR]],
];
const A_X = 2, A_COPY_X = 13.3;
const letterA = (x, props) => <g {...props}>{aStrokes(x).map(([[x1, y1], [x2, y2]], i) => <path key={i} d={`M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`} />)}</g>;
const aCopy = { strokeDasharray: "1.1 1.35", stroke: "#7b8494", strokeWidth: 1.4 };
const dotsA = (dots) => S(<>{rule(A_BASE + 0.6, 1.5, 22.5)}{letterA(A_X)}{letterA(A_COPY_X, aCopy)}{dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.55} fill={RED} stroke="none" />)}</>);
const aStart = (x) => aStrokes(x).map(([p]) => p);
export const IconDotsNone = () => dotsA([]);
export const IconDotsOne = () => dotsA([aStart(A_X)[0]]);
export const IconDotsAll = () => dotsA([aStart(A_X)[0], aStart(A_COPY_X)[0]]);
export const IconDotsStrokes = () => dotsA([...aStart(A_X), aStart(A_COPY_X)[0]]);
export const IconRepSolid = () => S(<>{rule(18)}{hook(2)}{hook(2 + STEP, { stroke: "#9ca3af", strokeWidth: 1.6 })}{hook(2 + 2 * STEP, { stroke: "#9ca3af", strokeWidth: 1.6 })}</>);

// ---- what to put on the page: a symbol, a word, a text ------------------------------------------------------------------------
export const IconTabText = () => S(<><path d="M4 6h16M4 10.5h16M4 15h16M4 19.5h9" /></>);
export const IconAddRow = () => S(<><path d="M3 18h10" strokeWidth="1.6" /><path d="M3 12h10" strokeDasharray="2 2.4" strokeWidth="1.4" /><path d="M18 8v8M14 12h8" /></>);

// ---- clear, undo / redo, lock -------------------------------------------------------------------------------------------------
// «Очистить» (2026-11-24): the sheet with its lines and an eraser on it — the eraser alone was small and read as «a tag»
export const IconClearPage = () => S(<><path d="M13 20.5H5.2a1.7 1.7 0 01-1.7-1.7V5.2a1.7 1.7 0 011.7-1.7h8.6a1.7 1.7 0 011.7 1.7v4.3" /><path d="M6.5 8h6M6.5 11.5h4.5" strokeWidth="1.4" opacity=".6" /><path d="M14.6 21l-2.8-2.8a1.3 1.3 0 010-1.8l5.6-5.6a1.3 1.3 0 011.8 0l2.3 2.3a1.3 1.3 0 010 1.8L17.5 21z" /><path d="M14.4 13.6l4.9 4.9" /></>);
// undo / redo: curved arrows, as in the editors (Edits)
export const IconUndo = () => S(<><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></>);
export const IconRedo = () => S(<><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></>);
export const IconLock = () => S(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>);

// ---- margins: none / on the left of the first page / on the right of it (alternating on the spread): the page in ink, its rows grey, the margin red ----
const page = <rect x="5" y="3" width="14" height="18" rx="1.5" />;
export const IconMarginOff = () => S(<>{page}{rule(8, 7, 17)}{rule(12, 7, 17)}{rule(16, 7, 17)}<path d="M3.5 21.5L20.5 2.5" stroke={GRAY} strokeWidth={1.4} /></>);
export const IconMarginLeft = () => S(<>{page}{rule(8, 10.5, 17)}{rule(12, 10.5, 17)}{rule(16, 10.5, 17)}<path d="M8.6 3v18" stroke={RED} strokeWidth={1.5} /></>);
export const IconMarginRight = () => S(<>{page}{rule(8, 7, 13.5)}{rule(12, 7, 13.5)}{rule(16, 7, 13.5)}<path d="M15.4 3v18" stroke={RED} strokeWidth={1.5} /></>);

// ---- page formats: simply the name of the format ----
const formatText = (t) => S(<text x="12" y="16.2" textAnchor="middle" fontFamily="Nunito, system-ui, sans-serif" fontWeight="800" fontSize="10.5" fill="currentColor" stroke="none" letterSpacing="-.3">{t}</text>);
export const IconFormatA4 = () => formatText("А4");
export const IconFormatA5 = () => formatText("А5");

// ---- the list of elements: a hook and a fence on a row ----
// elements = a tile like the ones in the list: a ruled cell with one pen stroke in it
// «Элемент» (2026-11-24): one copybook element, large, on its row — the old one had two small hooks inside a frame, hard to see on a button
export const IconElement = () => S(<>{guide(12.5, 2.5, 21.5)}{baseRule(19.5, 2.5, 21.5)}<g transform="translate(8.2 -2.9) scale(1.2)" strokeWidth={1.6}>{shape("hook_big")}</g></>);
// the printed letter in a frame (the «Буква» button): the frame and the capital «А» in the app's teal, as the letter stands on the page
export const IconLetterFrame = () => S(<><rect x="3" y="3" width="18" height="18" rx="4.6" fill="#e8f4f1" stroke="#2a6b60" strokeWidth={1.8} /><path d="M8 17L12 7L16 17M9.5 13.6H14.5" stroke="#2a6b60" strokeWidth={2} /></>);

export const IconEditPage = () => S(<><path d="M4 20l5.5-1.2L19.8 8.5a2 2 0 000-2.8l-1.5-1.5a2 2 0 00-2.8 0L5.2 14.5z" /><path d="M13 6.7l4.3 4.3" /></>); // pencil: unlock the kit page layout, keep the rows

export const IconFitPage = () => S(<><rect x="8" y="6" width="8" height="12" rx="1.2" strokeWidth="1.4" /><path d="M3 7.5V3h4.5M16.5 3H21v4.5M21 16.5V21h-4.5M7.5 21H3v-4.5" strokeWidth="1.7" /></>); // the whole page in the frame
export const IconFitWidth = () => S(<><rect x="7" y="4" width="10" height="16" rx="1.5" strokeWidth="1.4" /><path d="M2.5 12h6M2.5 12l2.2-2.2M2.5 12l2.2 2.2M21.5 12h-6M21.5 12l-2.2-2.2M21.5 12l-2.2 2.2" strokeWidth="1.7" /></>); // the page as wide as the canvas
export const IconSpread = () => S(<><rect x="2" y="6" width="7.5" height="11" rx="1.3" /><path d="M10.6 11.5h3M12.2 9.9l1.6 1.6-1.6 1.6" strokeWidth="1.6" /><path d="M18 3.5h4v11.5" strokeWidth="1.4" opacity=".5" /><path d="M16.4 5h4v11.5" strokeWidth="1.4" opacity=".75" /><rect x="14.8" y="6.5" width="5.6" height="11.5" rx="1.1" fill="currentColor" fillOpacity=".12" /></>); // a setting of this row / page onto the rest: one sheet → the stack (2026-11-24: the four arrows read as «move»)
export const IconAddPage = () => S(<><rect x="5" y="3" width="14" height="18" rx="1.8" /><path d="M12 8.5v7M8.5 12h7" /></>); // a new blank page in the notebook

export const IconNotebook = () => S(<><rect x="5.5" y="3" width="13" height="18" rx="1.8" /><path d="M9 3v18" /><path d="M12 8h4M12 11.5h4" strokeWidth="1.4" /></>); // a notebook card in the library
export const IconRename = () => S(<><path d="M4 20h16" /><path d="M6 16l.8-3.2L15.6 4a1.8 1.8 0 012.6 0 1.8 1.8 0 010 2.6L9.4 15.4z" /></>);

// «Штрихи» (2026-11-24): «А» of three strokes, one in ink and two pale — «write a part of the letter» (was the same «А» with a dashed bar,
// which said nothing about parts; a copybook «а» at 24 px read as «0»)
export const IconStrokes = () => S(<><path d="M12 3.5L18.6 20.5M8.4 14.5h7.2" strokeWidth={2} opacity={0.25} /><path d="M12 3.5L5.4 20.5" strokeWidth={2.2} /></>);
// keep the changes in the notebook: a floppy disk, still the one save sign everybody reads (owner, 2026-11-19: the tick read as «закрыть»)
export const IconSave = () => S(<><path d="M5 4h11.5L20 7.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M8 4v4.5h7V4" /><rect x="7.5" y="13" width="9" height="7" rx=".5" /></>);
