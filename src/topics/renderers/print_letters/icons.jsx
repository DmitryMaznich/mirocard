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
export const IconPaperRuled = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 7H21" stroke="#9aa3af" strokeWidth="1.1" />
    <path d="M3 12H21" stroke="#9aa3af" strokeWidth="1.1" />
    <path d="M3 17H21" stroke="#9aa3af" strokeWidth="1.1" />
    <path d="M6 3.5v17" stroke="#dc2626" strokeWidth="1.3" />
  </svg>
);
