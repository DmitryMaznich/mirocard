// Line icons for the constructor's tool bar (24×24, stroke = currentColor), drawn for this topic.
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const Svg = ({ children }) => <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{children}</svg>;

export const IconUndo = () => <Svg><path {...S} d="M9 14 4 9l5-5" /><path {...S} d="M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>;
export const IconRedo = () => <Svg><path {...S} d="m15 14 5-5-5-5" /><path {...S} d="M20 9H10a6 6 0 0 0 0 12h3" /></Svg>;
export const IconA4 = () => <Svg><path {...S} d="M6 3h9l4 4v14H6z" /><path {...S} d="M15 3v4h4" /></Svg>;
export const IconA5 = () => <Svg><path {...S} d="M7 7h7l3 3v10H7z" /><path {...S} d="M14 7v3h3" /></Svg>;
export const IconGrid = () => <Svg><rect {...S} x="4" y="4" width="16" height="16" rx="1" /><path {...S} strokeWidth="1.3" d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" /></Svg>;
export const IconBigGrid = () => <Svg><rect {...S} x="4" y="4" width="16" height="16" rx="1" /><path {...S} strokeWidth="1.5" d="M12 4v16M4 12h16" /></Svg>;
export const IconName = () => <Svg><path {...S} d="M4 8h3M4 16h3" /><path {...S} strokeWidth="1.6" d="M9 9h11M9 17h11" /></Svg>;
export const IconVideo = () => <Svg><rect {...S} x="3" y="6" width="13" height="12" rx="2" /><path {...S} d="m16 10 5-3v10l-5-3" /></Svg>;
export const IconPlus = () => <Svg><path {...S} strokeWidth="2.4" d="M12 5v14M5 12h14" /></Svg>;
export const IconShuffle = () => <Svg><path {...S} d="M3 7h3c5 0 7 10 12 10h3" /><path {...S} d="M3 17h3c2 0 3.5-1.6 4.8-3.6M13.2 9.6C14.5 8.2 16 7 18 7h3" /><path {...S} d="m18 4 3 3-3 3M18 14l3 3-3 3" /></Svg>;
export const IconCopy = () => <Svg><rect {...S} x="8" y="8" width="12" height="12" rx="2" /><path {...S} d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Svg>;
export const IconUp = () => <Svg><path {...S} d="m6 14 6-6 6 6" /></Svg>;
export const IconDown = () => <Svg><path {...S} d="m6 10 6 6 6-6" /></Svg>;
export const IconTrash = () => <Svg><path {...S} d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
export const IconPdf = () => <Svg><path {...S} d="M7 3h7l5 5v13H7z" /><path {...S} d="M14 3v5h5M10 14l2 2 2-2M12 10v6" /></Svg>;
export const IconSolve = () => <Svg><path {...S} d="M4 20h4L19 9l-4-4L4 16z" /><path {...S} d="m13.5 6.5 4 4" /></Svg>;
export const IconBack = () => <Svg><path {...S} strokeWidth="2.4" d="M15 5l-7 7 7 7" /></Svg>;
export const IconChevUp = () => <Svg><path {...S} d="m6 15 6-6 6 6" /></Svg>;
export const IconChevDown = () => <Svg><path {...S} d="m6 9 6 6 6-6" /></Svg>;
