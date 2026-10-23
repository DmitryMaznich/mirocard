// verbs_v2 topic avatar and mode icons, shipped inside the deck ZIP
// (build.mjs packs meta.avatar and every mode's ui.icon). House style as in
// scripts/word-agreement-icons.mjs: 128×128, pale rounded card, flat fills,
// thick round strokes, no text. The recurring motif is a stick figure doing
// something — the topic is about actions, not objects.

const INK = "#263131";
const TEAL = "#4a9b8f";
const CORAL = "#ef6f5e";
const YELLOW = "#f3c969";
const BLUE = "#7bb0ff";
const GREEN = "#1f7a3f";

const svg = (bg, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="${bg}"/>${body}</svg>`;

// A stick figure: (x, y) is the hips, s scales the default ~46 px height.
const POSES = {
  run: { head: [9, -33], lines: ["M6 -25 L0 0", "M5 -19 L-5 -11 L-12 -14", "M5 -19 L15 -13 L20 -21", "M0 0 L12 5 L10 17", "M0 0 L-7 10 L-17 9"] },
  jump: { head: [0, -34], lines: ["M0 -26 L0 0", "M0 -21 L-12 -32", "M0 -21 L12 -32", "M0 0 L-8 10 L-4 18", "M0 0 L8 10 L4 18"] },
  stand: { head: [0, -34], lines: ["M0 -26 L0 0", "M0 -21 L-10 -9", "M0 -21 L10 -9", "M0 0 L-6 18", "M0 0 L6 18"] },
  wave: { head: [0, -34], lines: ["M0 -26 L0 0", "M0 -21 L-10 -9", "M0 -21 L11 -33", "M0 0 L-6 18", "M0 0 L6 18"] },
};
function figure(pose, x, y, s = 1, color = INK, width = 6) {
  const p = POSES[pose];
  const [hx, hy] = p.head;
  const paths = p.lines.map((d) => `<path d="${d}"/>`).join("");
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="${hx}" cy="${hy}" r="7" fill="${color}"/>` +
    `<g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></g>`;
}
// Sleeping figure lying on a line, for a second, different action.
function sleeper(x, y, s = 1, color = INK) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="-18" cy="-6" r="7" fill="${color}"/>` +
    `<g fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M-10 -4 L16 -4 L24 -2"/><path d="M-26 4 L28 4"/></g>` +
    `<text x="8" y="-14" font-family="Arial, sans-serif" font-weight="900" font-size="12" fill="${BLUE}">z</text></g>`;
}
const motion = (x, y, color = CORAL) =>
  `<g stroke="${color}" stroke-width="4" stroke-linecap="round"><path d="M${x} ${y} h-12"/><path d="M${x + 3} ${y + 10} h-14"/><path d="M${x} ${y + 20} h-10"/></g>`;
const card = (x, y, w, h, fill = "#fff", stroke = "#dfc9a7") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
const speaker = (x, y, color = TEAL) =>
  `<g transform="translate(${x} ${y})"><path d="M0 -7 h7 l10 -9 v32 l-10 -9 h-7 z" fill="${color}"/>` +
  `<g fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"><path d="M23 -6 q5 6 0 12"/><path d="M29 -12 q10 12 0 24"/></g></g>`;
const check = (x, y, s = 1) =>
  `<path d="M${x} ${y} l${6 * s} ${6 * s} l${12 * s} -${13 * s}" fill="none" stroke="${GREEN}" stroke-width="${5 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const AVATAR_PATH = "media/avatar.svg";
export const AVATAR_SVG = svg("#eef7f5",
  `<ellipse cx="66" cy="106" rx="30" ry="5" fill="#d3e8e3"/>` +
  motion(36, 48) + figure("run", 70, 78, 1.35, TEAL, 7));

export const MODE_ICONS = {
  verbs_intro: { path: "media/icons/verbs_intro.svg", svg: svg("#f5f9ff",
    card(14, 22, 64, 84) + figure("run", 48, 78, 0.95) + motion(28, 50, CORAL) + speaker(86, 64)) },
  verbs_act_out: { path: "media/icons/verbs_act_out.svg", svg: svg("#fff7ec",
    speaker(16, 46, CORAL) + `<text x="18" y="96" font-family="Arial, sans-serif" font-weight="900" font-size="34" fill="${CORAL}">!</text>` +
    figure("jump", 86, 82, 1.1, TEAL) + `<g stroke="${YELLOW}" stroke-width="4" stroke-linecap="round"><path d="M70 108 l-6 6"/><path d="M86 110 v8"/><path d="M102 108 l6 6"/></g>`) },
  verbs_show: { path: "media/icons/verbs_show.svg", svg: svg("#f5f9ff",
    speaker(48, 22) +
    card(10, 42, 50, 70, "#e8f6f3", TEAL) + figure("run", 34, 86, 0.68) +
    card(68, 42, 50, 70) + sleeper(93, 82, 0.72) +
    `<g fill="none" stroke="${CORAL}" stroke-linecap="round"><circle cx="50" cy="102" r="6" stroke-width="5"/><circle cx="50" cy="102" r="14" stroke-width="3" opacity=".55"/></g>`) },
  verbs_choose_all: { path: "media/icons/verbs_choose_all.svg", svg: svg("#f4fff7",
    card(12, 12, 48, 48, "#e8f6f3", TEAL) + figure("run", 36, 42, 0.52) + check(40, 48, 0.7) +
    card(68, 12, 48, 48) + sleeper(92, 40, 0.6) +
    card(12, 68, 48, 48) + figure("jump", 36, 98, 0.52) +
    card(68, 68, 48, 48, "#e8f6f3", TEAL) + figure("run", 92, 98, 0.52, INK) + check(96, 104, 0.7)) },
  verbs_question_answer: { path: "media/icons/verbs_question_answer.svg", svg: svg("#fff7ec",
    card(12, 30, 60, 78) + figure("wave", 42, 84, 0.95) +
    `<path d="M80 18 h32 a8 8 0 0 1 8 8 v26 a8 8 0 0 1 -8 8 h-18 l-10 10 v-10 h-4 a8 8 0 0 1 -8 -8 v-26 a8 8 0 0 1 8 -8 z" fill="${CORAL}"/>` +
    `<text x="96" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="30" fill="#fff">?</text>`) },
  verbs_choose_word: { path: "media/icons/verbs_choose_word.svg", svg: svg("#f5f9ff",
    card(30, 10, 68, 58) + figure("jump", 64, 46, 0.68) +
    `<rect x="18" y="78" width="92" height="16" rx="8" fill="#e5e7eb"/>` +
    `<rect x="18" y="100" width="92" height="18" rx="9" fill="${TEAL}"/>` +
    `<rect x="30" y="106" width="44" height="6" rx="3" fill="#fff"/><rect x="30" y="83" width="56" height="6" rx="3" fill="#9ca3af"/>`) },
};
