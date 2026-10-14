// The cover of a printed notebook as ONE template with options (docs/propis2-cover-template-spec.md, owner 2026-10-08): how the name
// is set, a decoration, the fields to fill in, the accent colour, the logo, and the back (the back of the cover: an alphabet, the
// digits, the signs... written in our own hand). The three designs of the first version are presets of it. The cover belongs to the
// notebook (`set.cover`, synced and copied with it); it only shows in the printed notebook.

// the name is printed (owner, 2026-10-14: the name written in our hand on the front, and the «Пропись» design built on it, are dropped;
// a stored "cursive" falls back to print in normalizeCover)
export const TITLE_STYLES = [
  { id: "print", label: "Печатное" },
];

// one decoration (owner, 2026-10-14): the spine — a 40 mm band of the notebook's paper centred on the fold of the cover's sheet (20 mm
// on the front, 20 mm on the back). The frame, the corners and the ruling / elements bands were dropped: a stored one falls back to none.
export const DECORS = [
  { id: "none", label: "Нет" },
  { id: "spine", label: "Корешок" },
];
// the paper of the spine: the notebook's own (its first page) or a chosen one; no dense slant (too busy on a 40 mm band)
export const SPINE_PAPERS = [
  { id: "auto", label: "Как в тетради" },
  { id: "propis", label: "Прописи" },
  { id: "square", label: "Клетка" },
  { id: "ruled", label: "Линейка" },
];
// `notebookPaper`: the grid kind of the notebook's first page ("propis" | "square" | "ruled")
export const spinePaperOf = (cover, notebookPaper) => {
  const id = cover?.spine && cover.spine !== "auto" ? cover.spine : notebookPaper;
  return ["propis", "square", "ruled"].includes(id) ? id : "propis";
};

export const FIELDS = [
  { id: "name", label: "Имя" },
  { id: "surname", label: "Фамилия" },
  { id: "class", label: "Класс" },
  { id: "school", label: "Школа" },
  { id: "started", label: "Начата" },
  { id: "finished", label: "Окончена" },
];

// dark shades only (owner, 2026-10-08): a black-and-white print still reads them
export const ACCENTS = [
  { id: "teal", label: "Бирюзовый", color: "#2f6f65" },
  { id: "gray", label: "Серый", color: "#4b5563" },
];

export const BACKS = [
  { id: "none", label: "Пусто" },
  { id: "alphabet", label: "Алфавит" },
  { id: "digits", label: "Цифры" },
  { id: "signs", label: "Знаки" },
  { id: "digits-signs", label: "Цифры и знаки" },
  { id: "punctuation", label: "Препинание" },
];

export const BACK_PAPERS = [
  { id: "copybook", label: "Прописи" },
  { id: "square", label: "Клетка" },
];
// the paper each back is drawn on unless chosen otherwise
const BACK_PAPER = { alphabet: "copybook", digits: "square", signs: "square", "digits-signs": "square", punctuation: "copybook", none: "copybook" };
export const backPaperOf = (kind) => BACK_PAPER[kind] ?? "copybook";

const FRONT_DEFAULT = { title: { text: null, style: "print", kicker: true }, decor: "none", spine: "auto", fields: ["name", "surname", "started"], accent: "teal", logo: true };

// The presets set the front only; the back stays as chosen.
export const PRESETS = [
  { id: "none", label: "Без обложки" },
  { id: "school", label: "Школьная", front: { title: { style: "print", kicker: true }, decor: "none", fields: ["name", "surname", "started"] } },
];

// the back a notebook gets by default: the digits on squared paper for a notebook that starts on squared paper, the alphabet otherwise
export const defaultBack = (squared = false) => (squared ? "digits" : "alphabet");

export function defaultCover({ squared = false } = {}) {
  const kind = defaultBack(squared);
  return { enabled: true, ...clone(FRONT_DEFAULT), back: { kind, paper: backPaperOf(kind) } };
}

// A preset applied to a cover: its front over what the cover has (the name text, colour, logo and back kept).
export function applyPreset(cover, presetId) {
  const base = normalizeCover(cover);
  if (presetId === "none") return { ...base, enabled: false };
  const p = PRESETS.find((x) => x.id === presetId);
  if (!p?.front) return base;
  return normalizeCover({ ...base, enabled: true, title: { ...base.title, ...p.front.title }, decor: p.front.decor, fields: [...p.front.fields] });
}

// Which preset the cover is (by its front), or null when it is a cover of its own.
export function presetOf(cover) {
  const c = normalizeCover(cover);
  if (!c.enabled) return "none";
  const sameFields = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const hit = PRESETS.find((p) => p.front && p.front.title.style === c.title.style && p.front.title.kicker === c.title.kicker && p.front.decor === c.decor && sameFields(p.front.fields, c.fields));
  return hit ? hit.id : null;
}

// The covers of the first version were stored on the device as `cover: "school" | "propis" | "sample" | "none"`. «С образцом» (the
// window with the notebook's first rows) and «Пропись» (the name in our hand) were dropped by the owner on 2026-10-14: both now give
// the default, and a stored
// `decor: "sample-window"` falls back to no decoration (normalizeCover).
export function migrateLegacy(legacy, opts) {
  const base = defaultCover(opts);
  if (legacy === "none") return { ...base, enabled: false };
  if (PRESETS.some((p) => p.id === legacy && p.front)) return applyPreset(base, legacy);
  return base;
}

const oneOf = (list, v, fallback) => (list.some((x) => x.id === v) ? v : fallback);

// Anything (an old document, another device's newer schema, a hand-edited value) -> a valid cover. Unknown values fall back to the
// defaults; fields keep the order of FIELDS, without repeats.
export function normalizeCover(raw, opts) {
  const d = defaultCover(opts);
  if (!raw || typeof raw !== "object") return d;
  const t = raw.title && typeof raw.title === "object" ? raw.title : {};
  const text = typeof t.text === "string" && t.text.trim() ? t.text.slice(0, 80) : null;
  const fields = Array.isArray(raw.fields) ? FIELDS.map((f) => f.id).filter((id) => raw.fields.includes(id)) : d.fields;
  const b = raw.back && typeof raw.back === "object" ? raw.back : {};
  const kind = oneOf(BACKS, b.kind, d.back.kind);
  return {
    enabled: raw.enabled !== false,
    // «ТЕТРАДЬ» is always there (owner, 2026-10-14: "мы же печатаем тетрадь"); the old switch is ignored
    title: { text, style: oneOf(TITLE_STYLES, t.style, d.title.style), kicker: true },
    decor: oneOf(DECORS, raw.decor, d.decor),
    spine: oneOf(SPINE_PAPERS, raw.spine, d.spine),
    fields,
    accent: oneOf(ACCENTS, raw.accent, d.accent),
    logo: raw.logo === undefined ? d.logo : Boolean(raw.logo),
    back: { kind, paper: oneOf(BACK_PAPERS, b.paper, backPaperOf(kind)) },
  };
}

export const accentColor = (id) => (ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]).color;
export const coverTitle = (cover, notebookTitle) => String(cover?.title?.text ?? "").trim() || String(notebookTitle ?? "").trim() || "Тетрадь";

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

// «12 листов»: the leaves of a notebook (two A5 pages a leaf; the cover not counted), printed on the back of its cover
export const leavesLabel = (n) => {
  const d = n % 10, h = n % 100;
  return `${n} ${d === 1 && h !== 11 ? "лист" : d >= 2 && d <= 4 && (h < 10 || h >= 20) ? "листа" : "листов"}`;
};
