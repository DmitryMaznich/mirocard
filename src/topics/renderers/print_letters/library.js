import { allElements, ladderRows } from "./model";

// «Мои тетради» for print_letters (docs/print-letters.md): the same
// architecture as propis2's library, without its many options.
//
// A notebook: { id, title, format, pages: [{ id, paper, blocks: [...] }],
// createdAt, updatedAt }. A block: { id, letterId, color, size, rows }, a row:
// { id, elements, support } (model.js).
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

// ---- ready notebooks («Готовые тетради») ----------------------------------
// Chosen by method (docs/print-letters.md, «Разворот 19»): the hand first
// (sticks and bars, large), then the straight-line letters by ladder, two
// per page, then a review sheet on ruled paper (the next step of the
// ladder — the skill moved off the grid).

let seq = 0;
const rid = (p) => `ready-${p}-${++seq}`;
const rowsOf = (list) => list.map((r) => ({ id: rid("r"), ...r }));

function ladderBlock(letter, color, size = 2) {
  return { id: rid("b"), letterId: letter.id, color, size, rows: rowsOf(ladderRows(letter)) };
}

function reviewBlock(letter, color) {
  const all = allElements(letter);
  return { id: rid("b"), letterId: letter.id, color, size: 2, rows: rowsOf([{ elements: all, support: "sample" }, { elements: [], support: "sample" }]) };
}

function page(blocks, paper = "cell") {
  return { id: rid("p"), paper, blocks };
}

export function readyNotebooks(byId) {
  const L = (id) => byId[id];
  const have = (...ids) => ids.every((id) => L(id));
  const out = [];
  const nb = (id, title, description, pages) => ({ id: `ready:${id}`, ready: true, title, description, format: "a4", pages, createdAt: 0, updatedAt: 0 });

  if (have("Г")) {
    const g = L("Г"); // strokes: 0 — верхняя черта, 1 — палочка
    out.push(nb("sticks", "Палочки и черточки", "Подготовка руки перед буквами, крупно: палочка сверху вниз, черта слева направо, потом вместе — получается Г.", [
      page([{
        id: rid("b"), letterId: g.id, color: "#8b93a1", size: 4,
        rows: rowsOf([
          { elements: [1], support: "dotted" },
          { elements: [1], support: "fade" },
          { elements: [0], support: "dotted" },
          { elements: [0], support: "fade" },
          { elements: [0, 1], support: "dotted" },
          { elements: [0, 1], support: "sample" },
        ]),
      }]),
    ]));
  }
  if (have("Г", "Т", "П", "Н")) {
    out.push(nb("straight-1", "Прямые линии 1: Г Т П Н", "Каждая буква лесенкой: элемент за элементом, потом опора убывает до пустой строки.", [
      page([ladderBlock(L("Г"), PALETTE[0]), ladderBlock(L("Т"), PALETTE[1])]),
      page([ladderBlock(L("П"), PALETTE[2]), ladderBlock(L("Н"), PALETTE[3])]),
    ]));
  }
  if (have("И", "Ш", "Е", "Ё")) {
    out.push(nb("straight-2", "Прямые линии 2: И Ш Е Ё", "Те же шаги. В И — первая наклонная, Ш — широкая буква, в Ё — точки.", [
      page([ladderBlock(L("И"), PALETTE[4]), ladderBlock(L("Ш"), PALETTE[5])]),
      page([ladderBlock(L("Е"), PALETTE[0]), ladderBlock(L("Ё"), PALETTE[1])]),
    ]));
  }
  const all = ["Г", "Т", "П", "Н", "И", "Ш", "Е", "Ё"];
  if (have(...all)) {
    const blocks = all.map((id, i) => reviewBlock(L(id), PALETTE[i % PALETTE.length]));
    out.push(nb("straight-review", "Повторяем прямые линии", "Все восемь букв на линейке: один образец и строка самостоятельно. Проверка, что буквы усвоены и пишутся без клетки.", [
      page(blocks.slice(0, 4), "line3"),
      page(blocks.slice(4), "line3"),
    ]));
  }
  return out;
}
