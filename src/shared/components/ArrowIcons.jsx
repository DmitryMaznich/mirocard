export function BackArrowIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M13.5 10H5M9 5.5L4.5 10 9 14.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ForwardArrowIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6.5 10H15M11 5.5L15.5 10 11 14.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M5.5 3.5l5 4.5-5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckmarkIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3.5 9.5l3.5 3.5 7-8.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BackspaceIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M6.8 3.5h7.2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6.8L2 9l4.8-5.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.2 7l4 4M12.2 7l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function RefreshIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 9a6 6 0 1 0 1.2-3.6M3 3.5V7h3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A blank page with a "+" — starting a new, empty menu — deliberately not a
// circular-arrows "repeat" glyph, which read as "run the same recipe again"
// (see PlannerActionBar's "Новое меню" button).
export function NewDocIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4.5 2.5h6l3 3v10h-9v-13Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10.5 2.5v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 8.5v5M6.5 11h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowUpSmallIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDownSmallIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 3v8M3.5 7.5L7 11l3.5-3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Paid-tier topic the parent hasn't been granted access to yet — the catalog
// tile's "request access" state.
export function LockSmallIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="6.5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

// Access request already sent, awaiting approval — the catalog tile's
// "pending" state (non-interactive).
export function ClockSmallIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 4.2V7l2.1 1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The catalog tile's "more actions" menu trigger (delete a personal deck,
// etc.) — three dots, deliberately quiet/low-contrast next to the louder
// status badge (see TopicTile.jsx) so it doesn't compete for attention.
export function MoreDotsIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
