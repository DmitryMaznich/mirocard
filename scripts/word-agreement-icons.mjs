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

// verb_gender_agreement: same "shape + verb bar" language as verb_number,
// but three differently-shaped, differently-coloured subjects (circle/
// triangle/square standing in for masc./fem./neut.) each get their own
// coloured ending block — one action word, three different endings.
const VERB_GENDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f3eefb"/>
  <circle cx="34" cy="40" r="10" fill="#3b82c4"/>
  <rect x="52" y="32" width="40" height="16" rx="8" fill="#2c2c2c"/>
  <rect x="94" y="32" width="14" height="16" rx="4" fill="#3b82c4"/>

  <path d="M34 74 l9 15 h-18 z" fill="#d1487a"/>
  <rect x="52" y="74" width="40" height="16" rx="8" fill="#2c2c2c"/>
  <rect x="94" y="74" width="14" height="16" rx="4" fill="#d1487a"/>

  <rect x="26" y="102" width="16" height="16" rx="3" fill="#e0a800"/>
  <rect x="52" y="102" width="40" height="16" rx="8" fill="#2c2c2c"/>
  <rect x="94" y="102" width="14" height="16" rx="4" fill="#e0a800"/>
</svg>`;

// numeral_agreement: a numeral paired with the word's changing ending boxed
// off, same visual language as case_agreement's dashed box — the numeral is
// the new trigger, the boxed ending is still the point.
const NUMERAL_AGREEMENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef3fb"/>
  <text x="34" y="80" text-anchor="middle" font-family="${FONT}" font-size="52" font-weight="800" fill="#3b5bdb">5</text>
  <text x="90" y="80" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="#2c2c2c">мяч<tspan fill="#3b5bdb">ей</tspan></text>
  <rect x="100" y="52" width="24" height="30" rx="6" fill="none" stroke="#3b5bdb" stroke-width="3" stroke-dasharray="4 4"/>
</svg>`;

// adjective_agreement: same "one root, three coloured endings" language as
// the topic avatar, but for an adjective instead of a noun — the point is
// the same descriptive word changing shape with what it describes.
const ADJECTIVE_AGREEMENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fdeef0"/>
  <text x="64" y="46" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="800" fill="#2c2c2c">больш<tspan fill="#c23a5e">ой</tspan></text>
  <text x="64" y="74" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="800" fill="#2c2c2c">больш<tspan fill="#c23a5e">ая</tspan></text>
  <text x="64" y="102" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="800" fill="#2c2c2c">больш<tspan fill="#c23a5e">ое</tspan></text>
</svg>`;

// possessive_agreement: same "one root, coloured endings" language as the
// topic avatar and adjective_agreement — свой/своя/своё, the most
// distinctively Russian of the possessives this mode drills.
const POSSESSIVE_AGREEMENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eafaf3"/>
  <text x="64" y="46" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="#2c2c2c">св<tspan fill="#1f8a5c">ой</tspan></text>
  <text x="64" y="74" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="#2c2c2c">св<tspan fill="#1f8a5c">оя</tspan></text>
  <text x="64" y="102" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="#2c2c2c">св<tspan fill="#1f8a5c">оё</tspan></text>
</svg>`;

// prepositions: one red ball is visibly inside a box. The spatial relation
// itself carries the meaning, so the icon remains usable before reading.
const PREPOSITIONS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef3fb"/>
  <rect x="28" y="51" width="72" height="48" rx="8" fill="#e0a25e" stroke="#b87837" stroke-width="6"/>
  <rect x="36" y="59" width="56" height="23" rx="4" fill="#8b572a"/>
  <circle cx="64" cy="72" r="15" fill="#ef6c5b" stroke="#c83e3e" stroke-width="4"/>
  <path d="M28 51h72" stroke="#b87837" stroke-width="8" stroke-linecap="round"/>
</svg>`;

// mode id -> zip-relative icon path + svg content
export const MODE_ICONS = {
  case_agreement:        { path: "media/icons/case_agreement.svg",       svg: CASE_AGREEMENT_SVG },
  verb_number_agreement: { path: "media/icons/verb_number.svg",          svg: VERB_NUMBER_SVG },
  verb_gender_agreement: { path: "media/icons/verb_gender.svg",          svg: VERB_GENDER_SVG },
  adjective_agreement:   { path: "media/icons/adjective_agreement.svg",  svg: ADJECTIVE_AGREEMENT_SVG },
  numeral_agreement:     { path: "media/icons/numeral_agreement.svg",    svg: NUMERAL_AGREEMENT_SVG },
  possessive_agreement:  { path: "media/icons/possessive_agreement.svg", svg: POSSESSIVE_AGREEMENT_SVG },
  prepositions:          { path: "media/icons/prepositions.svg",          svg: PREPOSITIONS_SVG },
};

export const AVATAR_PATH = "media/avatar.svg";
