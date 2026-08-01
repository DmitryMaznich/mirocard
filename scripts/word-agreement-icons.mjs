// Hand-drawn flat SVG pictograms for the word_agreement topic — same style
// as the app's built-in icon set (128×128, rounded card background, flat
// shapes/text, no gradients/shadows). Bundled into the deck zip by
// build-word-agreement-deck.mjs and referenced via meta.avatar / mode.ui.icon.

const FONT = "Arial, sans-serif";

// Topic avatar: the same word in three forms, endings picked out in the
// app's accent green — the whole point of the trainer at a glance.
export const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6f1"/>
  <text x="64" y="46" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="#2c2c2c">мяч</text>
  <text x="64" y="74" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="#2c2c2c">мяч<tspan fill="#2e9e5b">а</tspan></text>
  <text x="64" y="102" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="#2c2c2c">мяч<tspan fill="#2e9e5b">у</tspan></text>
</svg>`;

// case_agreement: one word, the changing ending boxed off.
const CASE_AGREEMENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6f1"/>
  <text x="58" y="78" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="800" fill="#2c2c2c">мяч<tspan fill="#2e9e5b">а</tspan></text>
  <rect x="86" y="50" width="28" height="36" rx="6" fill="none" stroke="#2e9e5b" stroke-width="3" stroke-dasharray="4 4"/>
</svg>`;

// verb_number_agreement: one thing → singular verb bar, several things →
// plural verb bar. Readable even before the child can read the words.
const VERB_NUMBER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fdf1e6"/>
  <circle cx="34" cy="42" r="10" fill="#e07c00"/>
  <rect x="56" y="34" width="48" height="16" rx="8" fill="#2c2c2c"/>
  <circle cx="26" cy="88" r="7" fill="#e07c00"/>
  <circle cx="42" cy="88" r="7" fill="#e07c00"/>
  <circle cx="58" cy="88" r="7" fill="#e07c00"/>
  <rect x="72" y="80" width="40" height="16" rx="8" fill="#2c2c2c"/>
</svg>`;

// Shared "not built yet" icon for the four placeholder modes — muted grey
// clock, visually distinct from the two working modes above.
const COMING_SOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0f0f0"/>
  <circle cx="64" cy="64" r="34" fill="none" stroke="#b0b0b0" stroke-width="8"/>
  <path d="M64 64 V40 M64 64 L82 76" stroke="#b0b0b0" stroke-width="8" stroke-linecap="round" fill="none"/>
</svg>`;

// mode id -> zip-relative icon path + svg content
export const MODE_ICONS = {
  case_agreement:        { path: "media/icons/case_agreement.svg",       svg: CASE_AGREEMENT_SVG },
  verb_number_agreement: { path: "media/icons/verb_number.svg",          svg: VERB_NUMBER_SVG },
  verb_gender_agreement: { path: "media/icons/coming_soon.svg",          svg: COMING_SOON_SVG },
  adjective_agreement:   { path: "media/icons/coming_soon.svg",          svg: COMING_SOON_SVG },
  numeral_agreement:     { path: "media/icons/coming_soon.svg",          svg: COMING_SOON_SVG },
  possessive_agreement:  { path: "media/icons/coming_soon.svg",          svg: COMING_SOON_SVG },
};

export const AVATAR_PATH = "media/avatar.svg";
