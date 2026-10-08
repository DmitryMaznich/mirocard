import SH from "./iconShapes.json";

// Pictograms of the «Прописи 2» constructor. Every control of the constructor is an icon (no visible text; the name of a
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
const shapeStart = (name) => SH[name].d[0].match(/-?\d*\.?\d+/g).slice(0, 2).map(Number);
const slants = (xs, y1, y2) => xs.map((x) => <path key={x} d={`M${x} ${y1}L${x - (y2 - y1) * 0.466} ${y2}`} stroke={GRAY} strokeWidth={1} />);
const redDot = (x, y) => <circle cx={x} cy={y} r={1.7} fill={RED} stroke="none" />;

// ---- paper kinds -------------------------------------------------------------------------------------------------------
export const IconPaperPropis = () => S(<>{slants([9, 15, 21, 27], 3, 21)}{rule(6)}{guide(12)}{baseRule(18)}</>);
export const IconPaperSquare = () => S(<><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" stroke={GRAY} strokeWidth={1.2} /><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" stroke={GRAY} strokeWidth={1.1} /></>);
export const IconPaperRuled = () => S(<>{rule(7, 3, 21)}{rule(12, 3, 21)}{rule(17, 3, 21)}<path d="M6 3.5v17" stroke={RED} strokeWidth={1.3} /></>);

// ---- row size (the letter «а» on its ruling), slant density, dashes, writing space ---------------------------------------
export const IconRowNarrow = () => S(<>{guide(3.5)}{rule(8)}{guide(12)}{baseRule(16)}{shape("a_narrow", 12 - SH.a_narrow.w / 2)}</>);
export const IconRowWide = () => S(<>{rule(6)}{guide(12)}{baseRule(18)}{shape("a_wide", 12 - SH.a_wide.w / 2)}</>);
export const IconSlantSparse = () => S(<>{slants([11, 21], 4, 20)}{baseRule(20)}</>);
export const IconSlantDense = () => S(<>{slants([7, 11, 15, 19, 23], 4, 20)}{baseRule(20)}</>);
export const IconDash = () => S(<>{rule(6)}{guide(12)}{baseRule(18)}</>);
export const IconWriteAfter = () => S(<>{baseRule(10.5)}{shape("a_narrow", 4, -5.5)}{baseRule(20, 2.5, 13)}<path d="M15.5 21l1.1-3.9 3.6-3.6 2.1 2.1-3.6 3.6z" strokeWidth={1.4} /></>);

// ---- page actions -------------------------------------------------------------------------------------------------------
export const IconPlay = () => S(<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" /></>);
export const IconFromMarked = () => S(<><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10.5 14.5l2 2 3.5-4" /></>);

// ---- row tools ---------------------------------------------------------------------------------------------------------
export const IconBackspace = () => S(<><path d="M8.5 5H20a1 1 0 011 1v12a1 1 0 01-1 1H8.5L3 12z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" /></>);
export const IconUp = () => S(<><path d="M12 19V5M6 11l6-6 6 6" /></>);
export const IconDown = () => S(<><path d="M12 5v14M6 13l6 6 6-6" /></>);
export const IconDuplicate = () => S(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></>);
export const IconTrash = () => S(<><path d="M4 7h16M10 7V4.5h4V7M6.5 7l1 13h9l1-13" /><path d="M10 11v6M14 11v6" /></>);
export const IconRepeat = () => S(<><path d="M17 3l3 3-3 3" /><path d="M4 11V9.5A3.5 3.5 0 017.5 6H20" /><path d="M7 21l-3-3 3-3" /><path d="M20 13v1.5a3.5 3.5 0 01-3.5 3.5H4" /></>);
export const IconWarn = () => S(<><path d="M12 3.5L2.8 19.5h18.4z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></>);

// ---- kinds of a row: the sample, the sample with start dots, a clean row ----------------------------------------------------
const hook = (x, props) => shape("hook", x, 0, props);
const copy = { strokeDasharray: "1.4 2", stroke: "#6b7280", strokeWidth: 1.5 };
const STEP = 7;
const [HX, HY] = shapeStart("hook");
export const IconMarkSample = () => S(<>{rule(18)}{hook(3)}{hook(12, copy)}</>);
export const IconMarkDots = () => S(<>{rule(18)}{hook(3)}{hook(12, copy)}{redDot(HX + 3, HY)}{redDot(HX + 12, HY)}</>);
export const IconMarkClean = () => S(<>{rule(18)}{guide(12)}</>);

// ---- row options: repeat (the element «крючок» and its copies), start dots, copies style ---------------------------------------
export const IconRepOne = () => S(<>{rule(18)}{hook(3)}</>);
export const IconRepAll = () => S(<>{rule(18)}{hook(2)}{hook(2 + STEP, copy)}{hook(2 + 2 * STEP, copy)}</>);
export const IconRepFade = () => S(<>{rule(18)}{hook(2)}{hook(2 + STEP, { ...copy, opacity: 0.55 })}{hook(2 + 2 * STEP, { ...copy, opacity: 0.22 })}</>);
export const IconDotsNone = () => S(<>{rule(18)}{hook(3)}{hook(12, copy)}<circle cx={HX + 3} cy={HY} r={1.7} stroke={RED} strokeWidth={1.1} /><path d="M3.5 21.5L20.5 3.5" stroke={GRAY} strokeWidth={1.3} /></>);
export const IconDotsOne = () => S(<>{rule(18)}{hook(3)}{hook(12, copy)}{redDot(HX + 3, HY)}</>);
export const IconDotsAll = () => S(<>{rule(18)}{hook(3)}{hook(12, copy)}{redDot(HX + 3, HY)}{redDot(HX + 12, HY)}</>);
export const IconCopyDash = () => S(<>{rule(18)}{hook(2)}{hook(2 + STEP, copy)}{hook(2 + 2 * STEP, copy)}</>);
export const IconCopySolid = () => S(<>{rule(18)}{hook(2)}{hook(2 + STEP, { opacity: 0.35 })}{hook(2 + 2 * STEP, { opacity: 0.35 })}</>);

// ---- what to put on the page: a symbol, a word, a text ------------------------------------------------------------------------
export const IconTabWord = () => S(<><path d="M3 18h18" strokeWidth="1.3" opacity=".5" /><path d="M4 17c0-5 1.3-7 3-7s2 2 2 4.5c0-2.5.8-4.5 2.2-4.5S13 12 13 17" strokeWidth="1.6" /><path d="M13 17c0-3 1.2-5 3-5s2.5 2 2.5 5" strokeWidth="1.6" /></>);
export const IconTabText = () => S(<><path d="M4 6h16M4 10.5h16M4 15h16M4 19.5h9" /></>);
export const IconAddRow = () => S(<><path d="M3 18h10" strokeWidth="1.6" /><path d="M3 12h10" strokeDasharray="2 2.4" strokeWidth="1.4" /><path d="M18 8v8M14 12h8" /></>);
export const IconAddBlank = () => S(<><rect x="3.5" y="7" width="17" height="10" rx="2" strokeDasharray="2.2 2.6" strokeWidth="1.5" /><path d="M12 10v4M10 12h4" /></>);
export const IconAddText = () => S(<><path d="M3 6h14M3 10.5h14M3 15h8" /><path d="M18 14v7M14.5 17.5h7" /></>);

// ---- the hint shown while no row is selected: tap a row, then a symbol ------------------------------------------------------------
export const IconTapHint = () => (
  <svg viewBox="0 0 120 40" width="120" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6 30h34M6 22h34" strokeDasharray="2 2.6" strokeWidth="1.4" opacity=".6" />
    <path d="M26 6v14l-3-2.5-2 .6 5.2 8.4c.9 1.4 2.2 2.2 3.8 2.2h4c2.2 0 4-1.8 4-4v-5.5c0-1.2-1-2.2-2.2-2.2-.4-1-1.3-1.5-2.3-1.5-.6-1-1.5-1.5-2.5-1.5H29V6a1.5 1.5 0 00-3 0z" strokeWidth="1.5" />
    <path d="M52 20h18M64 14l6 6-6 6" />
    <path d="M82 31c0-9 3-13 6-13s4 4 4 9c0-5 1.4-9 4-9s5 4 5 13" strokeWidth="2" stroke="#1d4ed8" />
  </svg>
);

// ---- presets ---------------------------------------------------------------------------------------------------------------
export const IconPresets = () => S(<><rect x="6.5" y="3" width="13" height="15" rx="1.6" /><path d="M4 7v12.5A1.5 1.5 0 005.5 21H16" /><path d="M10 8h6M10 11.5h6M10 15h3.5" strokeWidth="1.4" /></>);
export const IconSavePreset = () => S(<><path d="M6 3.5h12v17l-6-4-6 4z" /><path d="M12 7.5v5M9.5 10h5" /></>);
// clear the page: an eraser (the bin is «delete», the pencil ✎ is «edit»)
export const IconClearPage = () => S(<><path d="M14.5 4.5l5 5-8.5 8.5H6.5l-2.5-2.5a1.5 1.5 0 010-2.1z" /><path d="M10 9l5 5" /><path d="M11 18h9" stroke={GRAY} strokeWidth={1.4} /></>);
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
// elements = a tile like the ones in the list: two hooks (крючок влево, крючок вправо) on their ruling
export const IconElement = () => S(<><rect x="2" y="2" width="20" height="20" rx="3.5" stroke={GRAY} strokeWidth={1.2} />{rule(6, 3.5, 20.5)}{guide(12.5, 3.5, 20.5)}{baseRule(19, 3.5, 20.5)}{shape("hook_l_big", 5)}{shape("hook_big", 12.5)}</>);
export const IconAsText = () => S(<><path d="M4 6h16M4 10.5h16M4 15h16M4 19.5h9" /></>);

export const IconEditPage = () => S(<><path d="M4 20l5.5-1.2L19.8 8.5a2 2 0 000-2.8l-1.5-1.5a2 2 0 00-2.8 0L5.2 14.5z" /><path d="M13 6.7l4.3 4.3" /></>); // pencil: unlock the kit page layout, keep the rows

export const IconPaperAll = () => S(<><rect x="8" y="3" width="12" height="15" rx="1.6" /><path d="M5.5 6.5V19a1.6 1.6 0 001.6 1.6h9" /><path d="M11 8h6M11 11h6M11 14h6" strokeWidth="1.3" /></>); // this page's paper onto all pages of the notebook
export const IconAddPage = () => S(<><rect x="5" y="3" width="14" height="18" rx="1.8" /><path d="M12 8.5v7M8.5 12h7" /></>); // a new blank page in the notebook

export const IconNotebook = () => S(<><rect x="5.5" y="3" width="13" height="18" rx="1.8" /><path d="M9 3v18" /><path d="M12 8h4M12 11.5h4" strokeWidth="1.4" /></>); // a notebook card in the library
export const IconRename = () => S(<><path d="M4 20h16" /><path d="M6 16l.8-3.2L15.6 4a1.8 1.8 0 012.6 0 1.8 1.8 0 010 2.6L9.4 15.4z" /></>);

export const IconSave = () => S(<><path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.4" /></>); // confirm: keep the changes in the notebook
