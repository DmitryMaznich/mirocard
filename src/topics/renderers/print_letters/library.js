import { DEFAULT_STYLE, allElements, drawnSize, headerCells, ladderRows, letterH, pageOverflows, paperGap, paperOf, sheetCells } from "./model";
import { canWrite, wordLadderRows } from "./words";

// «Мои тетради» for print_letters (docs/print-letters.md): the same
// architecture as propis2's library, without its many options.
//
// A notebook: { id, title, format, pages: [{ id, paper, blocks: [...] }],
// createdAt, updatedAt }. A block: { id, letterId, color, size, rows }, a row:
// { id, elements, line, guide, dots } (model.js; older ones carry `support`, read by rowStyle).
//
// Storage, two layers:
//  - this device: localStorage (the whole library, and the draft of the
//    notebook being edited, so an unsaved notebook survives a closed app);
//  - the account: one kv document per notebook, `print_letters:nb:<id>`,
//    through the app's offline queue (the `accountKv` prop, src/topics/
//    accountKv.js). Last write wins per notebook by `updatedAt`; a deleted
//    notebook is a tombstone { id, deleted: true, updatedAt } so the delete
//    reaches the other devices too.

export const SYNC_PREFIX = "print_letters:nb:";
const LIB_KEY = "print_letters:library";
const DRAFT_KEY = "print_letters:draft";

export const PALETTE = ["#e8702a", "#2f8fd1", "#b5257a", "#3aa655", "#d1a62f", "#7a52c9"];

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyLibrary() {
  return { notebooks: [], deleted: {} };
}

export function blankPage(paper = "cell") {
  return { id: newId(), paper, blocks: [] };
}

export function newNotebook(title = "Новая тетрадь", format = "a4") {
  const now = Date.now();
  return { id: newId(), title, format, pages: [blankPage()], createdAt: now, updatedAt: now };
}

// A fresh copy (new ids all the way down) — «Копия», «Взять в мои».
export function copyNotebook(nb, title = nb.title) {
  const now = Date.now();
  return {
    ...nb,
    id: newId(),
    title,
    createdAt: now,
    updatedAt: now,
    ready: undefined,
    pages: nb.pages.map((p) => ({
      ...p,
      id: newId(),
      blocks: p.blocks.map((b) => ({ ...b, id: newId(), rows: b.rows.map((r) => ({ ...r, id: newId() })) })),
    })),
  };
}

export function notebookJson(nb) {
  if (!nb) return "";
  const { updatedAt, ...rest } = nb; // eslint-disable-line no-unused-vars
  return JSON.stringify(rest);
}

const valid = (nb) => nb && typeof nb === "object" && typeof nb.id === "string" && Array.isArray(nb.pages);

// ---- this device ----------------------------------------------------------

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the account copy still has the saved notebooks
  }
}

export function loadLocal() {
  const lib = readJson(LIB_KEY);
  if (!lib || !Array.isArray(lib.notebooks)) return emptyLibrary();
  return { notebooks: lib.notebooks.filter(valid), deleted: lib.deleted && typeof lib.deleted === "object" ? lib.deleted : {} };
}

export const saveLocal = (lib) => writeJson(LIB_KEY, lib);

// The draft: { nb, isNew } — the notebook being edited as it is on screen.
export function loadDraft() {
  const d = readJson(DRAFT_KEY);
  return d && valid(d.nb) ? d : null;
}
export const saveDraft = (draft) => writeJson(DRAFT_KEY, draft);
export const clearDraft = () => writeJson(DRAFT_KEY, null);

// ---- library operations ---------------------------------------------------

export function putNotebook(lib, nb) {
  const others = lib.notebooks.filter((n) => n.id !== nb.id);
  const deleted = { ...lib.deleted };
  delete deleted[nb.id];
  return { notebooks: [nb, ...others], deleted };
}

export function removeNotebook(lib, id, at = Date.now()) {
  return { notebooks: lib.notebooks.filter((n) => n.id !== id), deleted: { ...lib.deleted, [id]: at } };
}

export const sortedNotebooks = (lib) => [...lib.notebooks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

// ---- the account ----------------------------------------------------------

export const docKey = (id) => `${SYNC_PREFIX}${id}`;

export function docFor(lib, id) {
  const nb = lib.notebooks.find((n) => n.id === id);
  if (nb) return nb;
  if (lib.deleted[id] !== undefined) return { id, deleted: true, updatedAt: lib.deleted[id] };
  return null;
}

// Fold the account's documents into the local library, newest wins per
// notebook. Returns the merged library and the ids whose local version is
// newer than (or missing from) the account — to send up.
export function mergeRemote(lib, items) {
  const notebooks = new Map(lib.notebooks.map((n) => [n.id, n]));
  const deleted = { ...lib.deleted };
  const remoteAt = new Map();
  for (const item of items ?? []) {
    const key = String(item?.key ?? "");
    if (!key.startsWith(SYNC_PREFIX)) continue;
    const id = key.slice(SYNC_PREFIX.length);
    const v = item.value;
    if (!v || typeof v !== "object") continue;
    const ts = Number(v.updatedAt) || 0;
    remoteAt.set(id, ts);
    const local = notebooks.get(id);
    const localTs = local ? Number(local.updatedAt) || 0 : deleted[id] ?? -1;
    if (ts <= localTs) continue;
    if (v.deleted) {
      notebooks.delete(id);
      deleted[id] = ts;
    } else if (valid(v)) {
      notebooks.set(id, v);
      delete deleted[id];
    }
  }
  const merged = { notebooks: [...notebooks.values()], deleted };
  const push = [];
  for (const n of merged.notebooks) if (!(remoteAt.get(n.id) >= (Number(n.updatedAt) || 0))) push.push(n.id);
  for (const [id, ts] of Object.entries(deleted)) if (!(remoteAt.get(id) >= ts)) push.push(id);
  return { lib: merged, push };
}

// ---- «Лист для тетради» (the end of a «Пишу на экране» lesson) ------------------
// (owner, 2026-11-04: «основной блок на каждую букву… 3-4 строки будет достаточно») The letters the child
// has just written on the screen, on paper: one block per letter on the 5mm cell, in the lesson's order —
// a dotted row with start dots, a fading row, a sample and write on, a blank row from memory. Saved to
// «Мои тетради» as an ordinary notebook (the adult can print it or edit it in the constructor).
export const OPEN_KEY = "print_letters:open"; // sessionStorage: a notebook id to open when the topic opens

export function paperRows(letter) {
  const all = allElements(letter);
  return [
    { elements: all, ...DEFAULT_STYLE },
    { elements: all, line: "tone", guide: "fade", dots: "all", arrows: true },
    { elements: all, line: "tone", guide: "none", dots: "sample", arrows: true },
    { elements: [], ...DEFAULT_STYLE },
  ];
}

export function lessonNotebook(letters, title, at = Date.now()) {
  const blocks = letters.map((letter, i) => ({
    id: newId(), letterId: letter.id, color: PALETTE[i % PALETTE.length], size: 2,
    rows: paperRows(letter).map((r) => ({ id: newId(), ...r })),
  }));
  const pages = [];
  let cur = [];
  for (const b of blocks) {
    if (cur.length && pageOverflows({ paper: "cell", blocks: [...cur, b] }, "a4")) { pages.push({ id: newId(), paper: "cell", blocks: cur }); cur = []; }
    cur.push(b);
  }
  pages.push({ id: newId(), paper: "cell", blocks: cur });
  return reflowNotebook({ id: newId(), title, format: "a4", pages, createdAt: at, updatedAt: at });
}

// Into this device's library and the account (the constructor merges both when it opens).
export function addNotebook(nb, accountKv) {
  const next = putNotebook(loadLocal(), nb);
  saveLocal(next);
  if (accountKv?.put) Promise.resolve(accountKv.put(docKey(nb.id), nb)).catch(() => {});
  return nb;
}

// ---- automatic page breaks ---------------------------------------------------
// (owner, 2026-11-03: «авто разрыв и перенос на следующую страницу») After every change, a page whose
// blocks no longer fit its sheet passes the overflow on, in order:
//  - several blocks on it — the last block moves, whole, to the top of the next page (a block is kept
//    together where it can be);
//  - one block that alone is taller than the sheet — the rows that don't fit go on as a continuation
//    of that block (same letter / word, colour and plate) at the top of the next page;
//  - no next page, or the next one has another paper — a new page with this page's paper is put
//    right after it.
// It cascades down the notebook. Nothing is pulled back up when rows are removed (pages would jump
// under the hand at every edit). Row and block ids are kept, so a selection can follow what moved.
export function reflowPages(pages, format) {
  const out = pages.map((p) => ({ ...p, blocks: [...p.blocks] }));
  let changed = false;
  for (let i = 0; i < out.length; i++) {
    const pg = out[i];
    let guard = 0;
    while (pageOverflows(pg, format) && guard++ < 200) {
      changed = true;
      let target = out[i + 1];
      if (!target || paperOf(target) !== paperOf(pg)) {
        target = { id: newId(), paper: pg.paper, blocks: [] };
        out.splice(i + 1, 0, target);
      }
      if (pg.blocks.length > 1) {
        target.blocks.unshift(pg.blocks.pop());
        continue;
      }
      const b = pg.blocks[0];
      const paper = paperOf(pg);
      const g = paperGap(paper);
      const avail = sheetCells(format).rows - headerCells(paper);
      const fit = Math.max(1, Math.floor((avail - g) / (g + letterH(drawnSize(b, paper)))));
      if (fit >= b.rows.length) break; // can't be helped (a single row taller than the sheet)
      pg.blocks[0] = { ...b, rows: b.rows.slice(0, fit) };
      target.blocks.unshift({ ...b, id: newId(), rows: b.rows.slice(fit) });
    }
  }
  return changed ? out : pages;
}

export function reflowNotebook(nb) {
  if (!nb?.pages) return nb;
  const pages = reflowPages(nb.pages, nb.format ?? "a4");
  return pages === nb.pages ? nb : { ...nb, pages };
}

// ---- ready notebooks («Готовые тетради») ----------------------------------
// A course after Ilyukhina's «Волшебные линии» №2 (owner, 2026-11-03: «ответь сам как логопед
// методист»; docs/print-letters.md, «Готовые тетради — курс по занятиям»):
//  - «Подготовка руки» — the elements first, large (her workbook №1): stick, bar, slants, half-oval,
//    oval;
//  - one notebook per lesson (2–16): the lesson's new letters, each by its ladder on «крупная клетка»
//    (the workbook's 1cm cell, one letter per page), then a review page on 5mm «клетка» — the new
//    letters after a sample, a row alternating the letters learnt lately (her «чередование букв»),
//    syllables and words made only of letters learnt so far (from lesson 4, when the first vowels
//    come);
//  - after each family a review on «линейка», where the skill leaves the grid.
// `section` groups them on the «Мои тетради» screen.

export const READY_SECTIONS = ["Подготовка руки", "Прямые линии", "Наклонные линии", "Овалы и полуовалы"];

let seq = 0;
const rid = (p) => `ready-${p}-${++seq}`;
const rowsOf = (list) => list.map((r) => ({ id: rid("r"), ...r }));

const SAMPLE_ONLY = { line: "tone", guide: "none", dots: "sample", arrows: true };
const FADING = { line: "tone", guide: "fade", dots: "all", arrows: true };

function ladderBlock(letter, color, size = 2) {
  return { id: rid("b"), letterId: letter.id, color, size, rows: rowsOf(ladderRows(letter)) };
}

function reviewBlock(letter, color) {
  const all = allElements(letter);
  return { id: rid("b"), letterId: letter.id, color, size: 2, rows: rowsOf([{ elements: all, ...SAMPLE_ONLY }, { elements: [], ...DEFAULT_STYLE }]) };
}

function wordBlock(words, color, rows = wordLadderRows(words)) {
  return { id: rid("b"), kind: "word", words, color, size: 2, rows: rowsOf(rows) };
}

function page(blocks, paper = "cell") {
  return { id: rid("p"), paper, blocks };
}

// Blocks onto as few A4 pages as they fit, in order.
function pack(blocks, paper) {
  const pages = [];
  let cur = [];
  for (const b of blocks) {
    if (cur.length && pageOverflows({ paper, blocks: [...cur, b] }, "a4")) { pages.push(page(cur, paper)); cur = []; }
    cur.push(b);
  }
  if (cur.length) pages.push(page(cur, paper));
  return pages;
}

// The same, but spread evenly over those pages (13 review letters: 5 + 4 + 4, not 6 + 6 + 1).
function packEven(blocks, paper) {
  const n = pack(blocks, paper).length;
  const per = Math.ceil(blocks.length / n);
  const pages = [];
  for (let i = 0; i < blocks.length; i += per) pages.push(page(blocks.slice(i, i + per), paper));
  return pages;
}

// The lessons of workbook №2 that bring letters (lesson 1 is the alphabet and the cell), with the
// syllables and words of each — only letters learnt by then; the words are hers where she gives
// them (МАМА — 10, ФИЛИН and ФЛАГ — 13, ЖИРАФ — 14, ГУСЬ — 14/16), the rest everyday things.
const LESSONS = [
  { n: 2, letters: ["Г", "Т", "Ч"], section: 1 },
  { n: 3, letters: ["П", "Н"], section: 1, hint: "в букве П «спряталась» Г" },
  { n: 4, letters: ["Е", "Ё", "Ш"], section: 1, syllables: ["ТЕ", "НЕ", "ПЕ", "ШЕ"], words: ["НЕТ"] },
  { n: 5, letters: ["Л", "А"], section: 2, syllables: ["ЛА", "ТА", "НА", "ПА"], words: ["ПАПА", "ЛАПА"], hint: "Л — «домик», А — тот же домик с перекладиной" },
  { n: 6, letters: ["И", "Й", "Д"], section: 2, syllables: ["ДА", "ДИ", "ЛИ", "НИ"], words: ["ЧАЙ", "ЛИПА"], hint: "Д получается из Л" },
  { n: 7, letters: ["Ц", "Щ"], section: 2, syllables: ["ЦА", "ЩА", "ЩИ"], words: ["ПТИЦА"], hint: "хвостик — под строкой" },
  { n: 8, letters: ["У", "Х"], section: 2, syllables: ["ТУ", "ДУ", "ХА", "ХИ"], words: ["УХА", "УЛИЦА"] },
  { n: 9, letters: ["К", "Ж"], section: 2, syllables: ["КА", "КУ", "ЖА", "ЖИ"], words: ["ЖУК", "КАША"], alternation: "УХКЖ" },
  { n: 10, letters: ["М"], section: 2, syllables: ["МА", "МУ", "МИ", "МЕ"], words: ["МАМА", "МУХА"] },
  { n: 11, letters: ["Ь", "Ъ", "Ы"], section: 3, syllables: ["МЫ", "ТЫ", "НЫ", "ДЫ"], words: ["МЫШКА", "ПЫЛЬ"] },
  { n: 12, letters: ["Р", "Б"], section: 3, syllables: ["РА", "РУ", "БА", "БЫ"], words: ["РЫБА", "РУКА"], hint: "у Б верхняя черта — последней" },
  { n: 13, letters: ["Ф", "Я"], section: 3, syllables: ["ФА", "ЛЯ", "МЯ", "ТЯ"], words: ["ФИЛИН", "ФЛАГ"] },
  { n: 14, letters: ["В", "З"], section: 3, syllables: ["ВА", "ВЕ", "ЗА", "ЗИ"], words: ["ВАЗА", "ЖИРАФ"] },
  { n: 15, letters: ["О", "Ю"], section: 3, syllables: ["ЛО", "НО", "МО", "ЛЮ"], words: ["ЮЛА", "ДОМ"] },
  { n: 16, letters: ["С", "Э"], section: 3, syllables: ["СА", "СО", "СУ", "СЫ"], words: ["ЭХО", "ГУСЬ"] },
];

const FAMILY_REVIEW = [
  { id: "review-straight", section: 1, title: "Повторяем прямые линии", letters: ["Г", "Т", "Ч", "П", "Н", "Е", "Ё", "Ш"] },
  { id: "review-slant", section: 2, title: "Повторяем наклонные линии", letters: ["Л", "А", "И", "Й", "Д", "Ц", "Щ", "У", "Х", "К", "Ж", "М"] },
  { id: "review-oval", section: 3, title: "Повторяем овалы", letters: ["Ь", "Ъ", "Ы", "Р", "Б", "Ф", "Я", "В", "З", "О", "Ю", "С", "Э"] },
];

export function readyNotebooks(byId) {
  const L = (id) => byId[id];
  const have = (...ids) => ids.every((id) => L(id));
  const out = [];
  const nb = (id, section, title, description, pages) => ({ id: `ready:${id}`, ready: true, section: READY_SECTIONS[section], title, description, format: "a4", pages, createdAt: 0, updatedAt: 0 });
  const color = (i) => PALETTE[i % PALETTE.length];

  // Подготовка руки: the elements on their own, large — each a stroke of a letter (the plate shows
  // the letter it ends up in): stick and bar (Г), the two slants (Л), half-oval (С), oval (О).
  if (have("Г", "Л", "С", "О")) {
    const el = (letter, elementRows, c) => ({ id: rid("b"), letterId: letter.id, color: c, size: 2, rows: rowsOf(elementRows) });
    out.push(nb("hand", 0, "Подготовка руки: палочки, наклонные, овалы", "Элементы букв по одному, крупно, в клетке 1 см: палочка сверху вниз и черта слева направо (из них Г), наклонные вверх и вниз (из них Л), полуовал (С) и овал (О) — сверху, против часовой стрелки.", [
      page([
        el(L("Г"), [{ elements: [0], ...DEFAULT_STYLE }, { elements: [0], ...FADING }, { elements: [1], ...DEFAULT_STYLE }, { elements: [1], ...FADING }, { elements: [0, 1], ...DEFAULT_STYLE }], "#8b93a1"),
        el(L("Л"), [{ elements: [0], ...DEFAULT_STYLE }, { elements: [1], ...DEFAULT_STYLE }, { elements: [0, 1], ...FADING }], color(1)),
      ], "bigcell"),
      page([
        el(L("С"), [{ elements: [0], ...DEFAULT_STYLE }, { elements: [0], ...FADING }, { elements: [0], ...SAMPLE_ONLY }], color(2)),
        el(L("О"), [{ elements: [0], ...DEFAULT_STYLE }, { elements: [0], ...FADING }, { elements: [0], ...SAMPLE_ONLY }], color(3)),
      ], "bigcell"),
    ]));
  }

  const learnt = [];
  LESSONS.forEach((lesson, li) => {
    if (!have(...lesson.letters)) return;
    learnt.push(...lesson.letters);
    // new letters: one per page on крупная клетка, by its ladder
    const pages = lesson.letters.map((id, k) => page([ladderBlock(L(id), color(li + k))], "bigcell"));
    // review on клетка 5 мм
    const review = [];
    review.push(wordBlock(lesson.letters, color(li), [
      ...lesson.letters.map((id) => ({ text: id, elements: [0], ...SAMPLE_ONLY })),
      { text: lesson.letters[0], elements: [], ...DEFAULT_STYLE },
    ]));
    const alt = lesson.alternation ?? (learnt.length >= 4 ? learnt.slice(-5).join("") : null);
    if (alt && canWrite(alt, byId)) {
      review.push(wordBlock([alt], color(li + 1), [
        { text: alt, elements: [...alt].map((_, i) => i), line: "dash", guide: "full", dots: "sample", arrows: false },
        { text: alt, elements: [...alt].map((_, i) => i), line: "tone", guide: "fade", dots: "sample", arrows: false },
        { text: alt, elements: [], ...DEFAULT_STYLE },
      ]));
    }
    const syl = (lesson.syllables ?? []).filter((w) => canWrite(w, byId)).slice(0, 3);
    if (syl.length) review.push(wordBlock(syl, color(li + 2)));
    const words = (lesson.words ?? []).filter((w) => canWrite(w, byId));
    for (const [k, w] of words.entries()) review.push(wordBlock([w], color(li + 3 + k)));
    pages.push(...pack(review, "cell"));
    const what = [
      `Новые буквы ${lesson.letters.join(" ")} — лесенкой, каждая на своей странице, в клетке 1 см.`,
      lesson.hint ? `Подсказка: ${lesson.hint}.` : "",
      `Повторение на клетке: буквы по образцу${alt ? `, чередование ${[...alt].join(" ")}` : ""}${syl.length ? `, слоги ${syl.join(" ")}` : ""}${words.length ? `, ${words.length > 1 ? "слова" : "слово"} ${words.join(", ")}` : ""}.`,
    ].filter(Boolean).join(" ");
    out.push(nb(`lesson-${lesson.n}`, lesson.section, `Занятие ${lesson.n}: ${lesson.letters.join(" ")}`, what, pages));
    const fam = FAMILY_REVIEW.find((f) => f.section === lesson.section && lesson.n === Math.max(...LESSONS.filter((x) => x.section === f.section).map((x) => x.n)));
    if (fam && have(...fam.letters)) {
      out.push(nb(fam.id, fam.section, fam.title, `Все буквы группы на линейке: один образец и строка самостоятельно. Проверка, что буквы усвоены и пишутся без клетки — по строке и до пунктира.`,
        packEven(fam.letters.map((id, k) => reviewBlock(L(id), color(k))), "line")));
    }
  });
  return out;
}
