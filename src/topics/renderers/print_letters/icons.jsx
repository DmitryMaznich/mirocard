// This topic's UI chrome icons — generic action pictograms (trash, undo-
// style arrows, a plus...) copied path-for-path from propis2's own
// Propis2Icons.jsx where it draws the same generic action, per the owner:
// "look at the icon style on the propis2 constructor's buttons." These
// shapes aren't propis2-specific content (a trash can is a trash can); the
// one deliberately-NOT-copied kind is propis2's page/ruling pictograms,
// which really do draw propis2's own cursive content.
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
const S = (children) => <svg {...base}>{children}</svg>;

export const IconPlus = () => S(<path d="M12 5v14M5 12h14" />);
// Copied from propis2's IconTrash (Propis2Icons.jsx) — same shape, verbatim.
export const IconTrash = () => S(<><path d="M4 7h16M10 7V4.5h4V7M6.5 7l1 13h9l1-13" /><path d="M10 11v6M14 11v6" /></>);
export const IconPrint = () => S(<><rect x="6" y="9" width="12" height="7" rx="1" /><path d="M8 9V4.5h8V9" /><path d="M8 16.5V19.5h8V16.5" /></>);
export const IconClose = () => S(<path d="M6 6l12 12M18 6L6 18" />);
export const IconCaret = () => S(<path d="M6 9l6 6 6-6" />);
export const IconBack = () => S(<path d="M15 5l-7 7 7 7" />);
// Copied from propis2's IconUp/IconDown.
export const IconUp = () => S(<path d="M12 19V5M6 11l6-6 6 6" />);
export const IconDown = () => S(<path d="M12 5v14M6 13l6 6 6-6" />);
// Copied from propis2's IconDuplicate.
export const IconDuplicate = () => S(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></>);
// Copied from propis2's IconLetterFrame — the one deliberately two-colour
// icon in the set (teal fill/stroke, not currentColor), since that is what
// makes "Буква" read as a distinct letter-tile rather than another line
// pictogram: a frame with the capital letter itself inside it, not an
// abstract plus.
export const IconLetterA = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="18" height="18" rx="4.6" fill="#e8f4f1" stroke="#2a6b60" strokeWidth="1.8" />
    <path d="M8 17L12 7L16 17M9.5 13.6H14.5" stroke="#2a6b60" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
// Copied from propis2's IconAddRow — an existing ruled line, a dashed one
// being typed, and a plus: "insert a row," not the same plus "Буква" uses
// for a different kind of insertion.
export const IconAddRow = () => S(<><path d="M3 18h10" strokeWidth="1.6" /><path d="M3 12h10" strokeDasharray="2 2.4" strokeWidth="1.4" /><path d="M18 8v8M14 12h8" /></>);
// Copied from propis2's IconPaperSquare/IconPaperRuled (Propis2Icons.jsx) —
// the same two-colour, non-currentColor convention as IconLetterA: a
// bordered square with its own cross-grid for "Клетка," plain grey rules
// plus the school-notebook red margin line for "Линейка."
export const IconPaperSquare = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" stroke="#9aa3af" strokeWidth="1.2" fill="none" />
    <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" stroke="#9aa3af" strokeWidth="1.1" />
  </svg>
);
// Ruled paper for printed letters: rows with a dashed height line and a
// solid baseline.
const rowLines = (y) => (
  <>
    <path d={`M3 ${y}H21`} stroke="#8aa2c4" strokeWidth="1" strokeDasharray="1.6 1.4" />
    <path d={`M3 ${y + 6}H21`} stroke="#5f7fa8" strokeWidth="1.4" />
  </>
);
export const IconPaperLine = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{rowLines(3)}{rowLines(14)}</svg>
);
// The 1cm big cell: a coarse 2×2 grid.
export const IconPaperBigCell = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#7fa7c9" strokeWidth="1.4" />
    <path d="M12 3v18M3 12h18" stroke="#7fa7c9" strokeWidth="1.4" />
  </svg>
);
export const IconPaperRuled = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 7H21" stroke="#9aa3af" strokeWidth="1.1" />
    <path d="M3 12H21" stroke="#9aa3af" strokeWidth="1.1" />
    <path d="M3 17H21" stroke="#9aa3af" strokeWidth="1.1" />
    <path d="M6 3.5v17" stroke="#dc2626" strokeWidth="1.3" />
  </svg>
);

// Copied from propis2's IconFormatA4/IconFormatA5 — the format's own name as the icon.
const formatText = (t) => S(<text x="12" y="16.2" textAnchor="middle" fontFamily="Nunito, system-ui, sans-serif" fontWeight="800" fontSize="10.5" fill="currentColor" stroke="none" letterSpacing="-.3">{t}</text>);
export const IconFormatA4 = () => formatText("А4");
export const IconFormatA5 = () => formatText("А5");
// A ladder: rows that grow step by step.
export const IconLadder = () => S(<><path d="M4 19h4M4 14h9M4 9h14" /><path d="M4 4.5h16" strokeDasharray="2 2.5" /></>);
// Copied from propis2's IconEditPage idea: a pencil.
export const IconEdit = () => S(<path d="M4 20h4l10-10-4-4L4 16z" />);
// Save: a floppy.
export const IconSave = () => S(<><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>);
// A new notebook: a page with a plus.
export const IconNewNotebook = () => S(<><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M12 9v6M9 12h6" /></>);

// ---- Copied path-for-path from src/features/propis2/Propis2Icons.jsx (2026-11-03): the constructor
// copies propis2's whole look, its pictograms included.
export const IconP2Save = () => S(<path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.4" />); // confirm: keep the changes
export const IconPlay = () => S(<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" /></>);
export const IconUndo = () => S(<><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></>);
export const IconRedo = () => S(<><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></>);
export const IconEditPage = () => S(<><path d="M4 20l5.5-1.2L19.8 8.5a2 2 0 000-2.8l-1.5-1.5a2 2 0 00-2.8 0L5.2 14.5z" /><path d="M13 6.7l4.3 4.3" /></>);
export const IconFitWidth = () => S(<><rect x="7" y="4" width="10" height="16" rx="1.5" strokeWidth="1.4" /><path d="M2.5 12h6M2.5 12l2.2-2.2M2.5 12l2.2 2.2M21.5 12h-6M21.5 12l-2.2-2.2M21.5 12l-2.2 2.2" strokeWidth="1.7" /></>);
export const IconAddPage = () => S(<><rect x="5" y="3" width="14" height="18" rx="1.8" /><path d="M12 8.5v7M8.5 12h7" /></>);
export const IconNotebook = () => S(<><rect x="5.5" y="3" width="13" height="18" rx="1.8" /><path d="M9 3v18" /><path d="M12 8h4M12 11.5h4" strokeWidth="1.4" /></>);
