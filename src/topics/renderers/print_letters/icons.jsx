// Small line-icon set for this topic's UI chrome, drawn fresh in the same
// recipe propis2's own icons use (24x24, stroke=currentColor, round caps) —
// not copied from Propis2Icons.jsx, which draws propis2-specific pictograms
// (paper/ruling/element shapes); these are generic action glyphs (add,
// trash, print...) with nothing propis2-specific to reuse.
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
const S = (children) => <svg {...base}>{children}</svg>;

export const IconPlus = () => S(<path d="M12 5v14M5 12h14" />);
export const IconTrash = () => S(<><path d="M4 7h16M9 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7M6.5 7l1 13h9l1-13" /><path d="M10 11v6M14 11v6" /></>);
export const IconPrint = () => S(<><rect x="6" y="9" width="12" height="7" rx="1" /><path d="M8 9V4.5h8V9" /><path d="M8 16.5V19.5h8V16.5" /></>);
export const IconClose = () => S(<path d="M6 6l12 12M18 6L6 18" />);
export const IconCaret = () => S(<path d="M6 9l6 6 6-6" />);
export const IconBack = () => S(<path d="M15 5l-7 7 7 7" />);
export const IconUp = () => S(<path d="M12 19V6M6 11l6-6 6 6" />);
export const IconDown = () => S(<path d="M12 5v13M6 13l6 6 6-6" />);
export const IconDuplicate = () => S(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></>);
export const IconLetter = () => S(<><path d="M5 19V5h10l4 4v10z" /><path d="M9 11h6M9 15h6" /></>);
