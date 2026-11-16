// One navigation style for every drawing mode (owner, 2026-11-16; first done in «Портрет по кубику»):
// - leaving the lesson is only the shared session header's ✕ (with confirmation) — no home buttons;
// - the adult's menu is the gear, opened by an ordinary tap (no long press anywhere else in the app);
// - each screen has one primary action, the big green round button bottom right;
// - «show again» (▶) sits in the top-left corner of the picture;
// - no words on the child's buttons — labels are for screen readers and the adult's menu.
const ICONS = {
  next: <path d="M11 24h24M25 13l11 11-11 11" />,
  paint: <><path d="M24 6C12 6 6 14 6 23c0 9 7 16 15 16 4 0 4-4 1-7-2-3 0-7 4-7h7c7 0 10-4 10-9 0-6-8-10-19-10Z" /><circle cx="15" cy="20" r="2.4" /><circle cx="23" cy="13" r="2.4" /><circle cx="32" cy="16" r="2.4" /></>,
  again: <path d="M12 16a14 14 0 1 1-2 15M11 7v10h10" />,
  drawings: <><rect x="7" y="7" width="14" height="14" rx="3" /><rect x="27" y="7" width="14" height="14" rx="3" /><rect x="7" y="27" width="14" height="14" rx="3" /><rect x="27" y="27" width="14" height="14" rx="3" /></>,
};
export function Primary({ icon = 'next', label, disabled, onClick }) {
  return <button type="button" className="drawing-primary" data-icon={icon} aria-label={label} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 48 48" aria-hidden="true">{ICONS[icon]}</svg></button>;
}
export function MenuButton({ onOpen }) {
  return <button type="button" className="drawing-adult drawing-menu" aria-label="Для взрослого" onClick={onOpen}>
    <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 3h6l1 4 4 2 4-1 3 5-3 3v4l3 3-3 5-4-1-4 2-1 4h-6l-1-4-4-2-4 1-3-5 3-3v-4l-3-3 3-5 4 1 4-2Z" /><circle cx="16" cy="18" r="5" /></svg>
  </button>;
}
export function ShowAgain({ label = 'Показать ещё раз', disabled, onClick }) {
  return <button type="button" className="drawing-show" aria-label={label} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 7.5v17l14-8.5z" /></svg></button>;
}
