// Pictograms of the «Прописи 2» constructor. Every control of the constructor is an icon (no visible text; the name of a
// control is its aria-label for screen readers). 24x24, drawn with currentColor so a button decides the colour.
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
const S = (children) => <svg {...base}>{children}</svg>;

// ---- paper kinds -------------------------------------------------------------------------------------------------------
export const IconPaperPropis = () => S(<><path d="M5 19h14" strokeWidth="2.4" /><path d="M5 12h14" strokeDasharray="1.6 2.2" strokeWidth="1.4" /><path d="M5 6h14" strokeWidth="1.2" /><path d="M9 4l-3 16M15 4l-3 16M21 4l-3 16" strokeWidth="1.2" opacity=".6" /></>);
export const IconPaperSquare = () => S(<><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" strokeWidth="1.3" /></>);
export const IconPaperRuled = () => S(<><path d="M4 7h16M4 12h16M4 17h16" /><path d="M4 4v16" stroke="#dc2626" strokeWidth="1.4" opacity=".7" /></>);

// ---- row size, slant density, dashes, writing space ---------------------------------------------------------------------
export const IconRowNarrow = () => S(<><path d="M3 13h18M3 19h18" /><path d="M8 18c0-3 1-4.5 2.2-4.5S12 15 12 17c0-1.5.8-3.5 2.2-3.5S16 15 16 18" strokeWidth="1.6" /></>);
export const IconRowWide = () => S(<><path d="M3 5h18M3 20h18" /><path d="M6.5 19c0-6 1.8-9 4-9s3 3 3 6c0-3 1-6 3-6s2.6 3 2.6 9" strokeWidth="1.6" /></>);
export const IconSlantSparse = () => S(<><path d="M9 4L6 20M19 4l-3 16" /></>);
export const IconSlantDense = () => S(<><path d="M5.5 4L4 20M10 4L8.5 20M14.5 4L13 20M19 4l-1.5 16" /></>);
export const IconDash = () => S(<><path d="M3 5h18M3 19h18" /><path d="M3 12h18" strokeDasharray="2 2.6" /></>);
export const IconWriteAfter = () => S(<><path d="M3 9h18" /><path d="M7 8.5c0-3 1-4 2-4s1.6 1.4 1.6 3c0-1.4.6-3 1.8-3S14 6 14 8.5" strokeWidth="1.5" /><path d="M3 19h11" strokeDasharray="2 2.6" /><path d="M16.5 20.5l1.2-4.3 3.5-3.5 2.2 2.2-3.5 3.5z" strokeWidth="1.5" /></>);

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
const loop = <path d="M3 16c0-4 1.4-6 3-6s2.4 2 2.4 4.5c0-2.5 1-4.5 2.6-4.5S13.4 12 13.4 16" strokeWidth="1.7" />;
export const IconMarkSample = () => S(<><path d="M2.5 19h19" strokeWidth="1.2" opacity=".5" />{loop}<g opacity=".4" transform="translate(9 0)" strokeDasharray="1.6 1.8">{loop}</g></>);
export const IconMarkDots = () => S(<><path d="M2.5 19h19" strokeWidth="1.2" opacity=".5" />{loop}<circle cx="4.2" cy="9.4" r="1.5" fill="#dc2626" stroke="none" /><circle cx="14.5" cy="9.4" r="1.5" fill="#dc2626" stroke="none" /><circle cx="19.5" cy="9.4" r="1.5" fill="#dc2626" stroke="none" /></>);
export const IconMarkClean = () => S(<><path d="M2.5 19h19" strokeWidth="1.2" opacity=".5" /><path d="M3 9h18M3 14h18" strokeDasharray="1.8 2.4" strokeWidth="1.4" opacity=".7" /></>);

// ---- row options: repeat, start dots, copies style -----------------------------------------------------------------------------
const baseLine = <path d="M2.5 19h19" strokeWidth="1.2" opacity=".5" />;
const dot = (x, y) => <circle cx={x} cy={y} r="1.6" fill="#dc2626" stroke="none" />;
export const IconRepOne = () => S(<>{baseLine}{loop}</>);
export const IconRepAll = () => S(<>{baseLine}{loop}<g transform="translate(6.5 0)">{loop}</g><g transform="translate(13 0)">{loop}</g></>);
export const IconRepFade = () => S(<>{baseLine}{loop}<g transform="translate(6.5 0)" opacity=".55">{loop}</g><g transform="translate(13 0)" opacity=".22">{loop}</g></>);
export const IconDotsNone = () => S(<>{baseLine}{loop}<path d="M4 4l16 16" stroke="#dc2626" /></>);
export const IconDotsOne = () => S(<>{baseLine}{loop}{dot(4, 9)}</>);
export const IconDotsAll = () => S(<>{baseLine}{loop}<g transform="translate(9 0)" opacity=".4" strokeDasharray="1.6 1.8">{loop}</g>{dot(4, 9)}{dot(13.2, 9)}</>);
export const IconCopyDash = () => S(<>{baseLine}{loop}<g transform="translate(9 0)" opacity=".7" strokeDasharray="1.6 1.8">{loop}</g></>);
export const IconCopySolid = () => S(<>{baseLine}{loop}<g transform="translate(9 0)" opacity=".28">{loop}</g></>);

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
export const IconClearPage = () => S(<><path d="M4 20l5.5-1.2L19.8 8.5a2 2 0 000-2.8l-1.5-1.5a2 2 0 00-2.8 0L5.2 14.5z" /><path d="M13 6.7l4.3 4.3M10 20h10" /></>);
export const IconUndo = () => S(<><path d="M9 7L4 12l5 5" /><path d="M4 12h10a6 6 0 010 12" transform="translate(0 -4)" /></>);
export const IconLock = () => S(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>);

// ---- margins: none / on the left of the first page / on the right of it (alternating on the spread) ----
export const IconMarginOff = () => S(<><rect x="5" y="3.5" width="14" height="17" rx="1.4" /><path d="M4 20L20 4" stroke="#dc2626" /></>);
export const IconMarginLeft = () => S(<><rect x="5" y="3.5" width="14" height="17" rx="1.4" /><path d="M8.5 3.5v17" stroke="#dc2626" strokeWidth="1.8" /></>);
export const IconMarginRight = () => S(<><rect x="5" y="3.5" width="14" height="17" rx="1.4" /><path d="M15.5 3.5v17" stroke="#dc2626" strokeWidth="1.8" /></>);

// ---- page formats ----
export const IconFormatA4 = () => S(<><rect x="3.5" y="2.5" width="17" height="19" rx="1.4" /><path d="M7 7h10M7 10.5h10M7 14h10M7 17.5h6" strokeWidth="1.3" /></>);
export const IconFormatA5 = () => S(<><rect x="6.5" y="5.5" width="11" height="13" rx="1.4" /><path d="M9 9h6M9 12h6M9 15h4" strokeWidth="1.3" /></>);

// ---- the list of elements: a hook and a fence on a row ----
export const IconElement = () => S(<><path d="M3 19h18" strokeWidth="1.2" opacity=".5" /><path d="M4 17c0-6 1.2-9 3-9s2.2 3 2.2 6c0-3 .8-6 2.6-6M13 17V7M17 17V7M21 17V7" strokeWidth="1.7" /></>);
export const IconAsText = () => S(<><path d="M4 6h16M4 10.5h16M4 15h16M4 19.5h9" /></>);
