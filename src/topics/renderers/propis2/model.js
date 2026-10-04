// «Прописи 2»: page model and its translation into the line strings the shared wide-row engine
// understands ("И#d" = sample with start dots, "И#c" = clean row, see wordEngine.js).
import { layoutWideLinesIntoRows, wideTokenToLabels, WIDE_ROW_MAX_X } from "../propis/wordEngine.js";
import { PRINT_ROWS_PER_PAGE } from "../propis/propisRuling.js";
import { outsideRowLabels } from "./glyphReach.js";

// Rows on one screen/paper page of the wide-row sheets (ruling row 0 is only the top edge).
export const ROWS_PER_PAGE = PRINT_ROWS_PER_PAGE - 1;

export const RULINGS = [
  { id: "narrow", label: "Узкая строка", short: "Узкая" },
  { id: "wide", label: "Широкая строка", short: "Широкая" },
];

// Slant grid, as in the finished copybooks: "regular" (редкая, стандартная школьная: a line every 20 mm) and
// "dense" (частая: every 2.5 mm on the narrow row, 5 mm on the wide one — the distance between the tops of «и», the letters' own cell). The methodology grid the glyphs snap to is not drawn.
export const GRIDS = [
  { id: "regular", label: "Редкая косая линейка (через 20 мм, стандарт)", short: "Редкая" },
  { id: "dense", label: "Частая косая линейка (через 2,5 мм на узкой строке, 5 мм на широкой)", short: "Частая" },
];

// What kind of paper: the copybook ("прописи", slant grid and row guides), a plain squared page ("клетка", 5 mm)
// or plain ruled paper ("линейка", only the baselines). The slant-grid options (GRIDS, dashes) belong to "propis".
export const GRID_KINDS = [
  { id: "propis", label: "Прописи" },
  { id: "square", label: "Клетка" },
  { id: "ruled", label: "Линейка" },
];
export const pageGridKind = (page) => page?.gridKind ?? (page?.grid === "square" ? "square" : "propis");
// The grid name the page task / PrintPageView understands.
export const taskGrid = (page) => {
  const kind = pageGridKind(page);
  if (kind !== "propis") return kind;
  return page?.grid === "dense" ? "dense" : "regular";
};

export const ROW_KINDS = [
  { id: "text", label: "Буквы, слоги, слова" },
  { id: "element", label: "Элемент" },
  { id: "passage", label: "Текст (переносится по строкам)" },
  { id: "blank", label: "Пустая строка для письма" },
];

export const ROW_MARKS = [
  { id: "", label: "Образец", short: "Образец" },
  { id: "d", label: "Образец + точки старта", short: "С точками" },
  { id: "c", label: "Чистая строка", short: "Чистая" },
];

let counter = 0;
export function newId(prefix = "p") {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Per-row options (block «Строка»). repeat: "all" (copies across the row), "one" (written once), "fade" (copies fade out
// to the row's middle); dots (red start dots): "all" (sample and copies), "one" (sample only), "none"; copies: "dash"
// (dashed, default) or "solid" (pale solid). Rows saved before these existed carry only `mark` ("" / "d" / "c").
export const REPEATS = ["all", "one", "fade"];
export const DOTS = ["all", "one", "none"];
export const COPY_STYLES = ["dash", "solid"];
export function rowParams(row) {
  const legacyDots = row?.mark === "c" ? "none" : "all";
  return {
    repeat: REPEATS.includes(row?.repeat) ? row.repeat : "all",
    dots: DOTS.includes(row?.dots) ? row.dots : legacyDots,
    copies: COPY_STYLES.includes(row?.copies) ? row.copies : "dash",
  };
}

export function newRow(patch = {}) {
  return { id: newId("r"), kind: "text", text: "", mark: "", marked: false, ...patch };
}

export function newPage(title = "Новая страница", patch = {}) {
  const now = Date.now();
  return { id: newId("pg"), title, ruling: "narrow", grid: "dense", midDash: true, writeAfter: false, rows: [newRow()], createdAt: now, updatedAt: now, ...patch };
}

// A ready methodology sheet ("Н#d", "г1 г1", "5 5"...) becomes an editable page.
export function pageFromLines(title, lines, ruling = "narrow", elementLabels = new Set()) {
  const rows = (lines ?? []).map((line) => {
    const m = /^(.*?)#([dc])$/.exec(line);
    const text = m ? m[1] : line;
    const isElement = elementLabels.has(text.trim());
    return newRow({ kind: isElement ? "element" : "text", text, mark: m ? m[2] : "", dots: m?.[2] === "c" ? "none" : "all" });
  });
  return newPage(title, { ruling, rows: rows.length ? rows : [newRow()] });
}

export function rowToLine(row) {
  if (row?.kind === "blank") return "";
  const text = String(row?.text ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  const { repeat, dots, copies } = rowParams(row);
  const flags = [];
  if (repeat === "one") flags.push("1");
  if (repeat === "fade") flags.push("f");
  if (dots === "none") flags.push("c");
  else if (dots === "one") flags.push("o");
  else if (row.mark === "d" || repeat === "one") flags.push("d"); // extra dots where the next copies would start
  if (copies === "solid") flags.push("s");
  return flags.length ? `${text}${flags.map((f) => `#${f}`).join("")}` : text;
}

const lineWidth = (text, glyphMap, ruling) => {
  const { placed } = layoutWideLinesIntoRows([text], glyphMap, undefined, false, ruling === "narrow" ? 0.5 : 1);
  return placed[0]?.segments?.[0]?.width ?? 0;
};

// Greedy wrap of running text into lines that fit the printable width. A single word wider than
// the line stays on its own line (the editor warns about it); nothing is cut.
export function wrapPassage(text, glyphMap, ruling = "narrow") {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const cand = cur ? `${cur} ${word}` : word;
    if (!cur || lineWidth(cand, glyphMap, ruling) <= WIDE_ROW_MAX_X) cur = cand;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Rows -> engine lines, in order. Row numbers on screen and on paper count this same list:
// sample rows, wrapped text lines (each written once, "#1"), blank writing rows ("" is a ruled
// empty row for the engine; a row that has no text yet is one too) and, when page.writeAfter is on, a blank row after
// every sample row.
export function pageToLines(page, glyphMap) {
  const out = [];
  for (const row of page?.rows ?? []) {
    if (row.kind === "blank") { out.push(""); continue; }
    if (row.kind === "passage") {
      const wrapped = glyphMap ? wrapPassage(row.text, glyphMap, page?.ruling) : String(row.text ?? "").trim() ? [String(row.text).trim()] : [];
      if (!wrapped.length) { out.push(""); continue; }
      for (const l of wrapped) { out.push(`${l}#1`); if (page?.writeAfter) out.push(""); }
      continue;
    }
    const line = rowToLine(row);
    // a row with no text yet still takes its place on the sheet (a ruled, empty row), so it can be selected and filled
    if (!line) { out.push(""); continue; }
    out.push(line);
    if (page?.writeAfter) out.push("");
  }
  return out;
}

// For every engine line of the page (the same list pageToLines builds) the index in page.rows of the row
// it came from, or null for a blank row the engine adds itself (writeAfter). The on-screen/paper row
// number of a model row is therefore its position in this list; the drag-and-drop editor maps a
// drop on a physical row back to a model row through it.
export function lineOwners(page, glyphMap) {
  const out = [];
  (page?.rows ?? []).forEach((row, i) => {
    if (row.kind === "blank") { out.push(i); return; }
    if (row.kind === "passage") {
      const n = glyphMap ? wrapPassage(row.text, glyphMap, page?.ruling).length : String(row.text ?? "").trim() ? 1 : 0;
      if (!n) { out.push(i); return; }
      for (let k = 0; k < n; k += 1) { out.push(i); if (page?.writeAfter) out.push(null); }
      return;
    }
    if (!rowToLine(row)) { out.push(i); return; }
    out.push(i);
    if (page?.writeAfter) out.push(null);
  });
  return out;
}

const isEmptyRow = (r) => r.kind !== "blank" && !String(r.text ?? "").trim();

// A tile from the carousel -> row content. element tiles carry the glyph id, letters the glyph label.
export const tileToRowPatch = (tile) => ({ kind: tile.kind === "element" ? "element" : tile.kind === "passage" ? "passage" : "text", text: tile.text });

// Drop a tile on physical row `absRow` (0-based over the whole page):
//  - on a row with content: that row takes the tile (it keeps its sample/dots/clean mark);
//  - on a blank row the page has: the row becomes the tile;
//  - on a row the engine added itself (writeAfter): a new row goes in right before it;
//  - below the last row: blank rows fill the gap, then the tile row.
// Rows that hold no text yet are dropped first (they print nothing), so rows and lines line up.
// Returns { page, rowId } so the caller can select the row that just got the tile.
export function dropTile(page, glyphMap, absRow, tile) {
  const base = { ...page, rows: page.rows.filter((r) => !isEmptyRow(r)) };
  const owners = lineOwners(base, glyphMap);
  const patch = tileToRowPatch(tile);
  let rows = base.rows;
  let rowId;
  const owner = absRow >= 0 && absRow < owners.length ? owners[absRow] : undefined;
  if (owner != null) {
    const old = rows[owner];
    rowId = old.id;
    rows = rows.map((r, i) => (i === owner ? { ...r, ...patch, mark: r.kind === "blank" || r.kind === "passage" || patch.kind === "passage" ? "" : r.mark } : r));
  } else if (owner === null) {
    const prev = owners.slice(0, absRow).reverse().find((o) => o != null);
    const row = newRow(patch);
    rowId = row.id;
    const at = prev == null ? 0 : prev + 1;
    rows = [...rows.slice(0, at), row, ...rows.slice(at)];
  } else {
    const gap = page.writeAfter ? 0 : Math.max(0, absRow - owners.length);
    const row = newRow(patch);
    rowId = row.id;
    rows = [...rows, ...Array.from({ length: gap }, () => newRow({ kind: "blank" })), row];
  }
  return { page: { ...page, rows: rows.length ? rows : [newRow(patch)] }, rowId };
}

// «Select a row, tap a symbol»: a letter or mark is added to the end of the selected row's text; an element (or any
// symbol on a blank / passage / element row) takes the row over. With no row selected the symbol starts a new row below
// the last one. Returns { page, rowId } (the row to keep selected).
export function tapSymbol(page, glyphMap, selectedId, tile) {
  const idx = selectedId ? page.rows.findIndex((r) => r.id === selectedId) : -1;
  if (idx < 0) return appendTile(page, glyphMap, tile);
  const row = page.rows[idx];
  let patch;
  if (tile.kind === "element") patch = { kind: "element", text: tile.text };
  else if (row.kind === "text") patch = { text: `${row.text ?? ""}${tile.text}` };
  else patch = { kind: "text", text: tile.text, mark: row.kind === "blank" || row.kind === "passage" ? "" : row.mark };
  return { page: { ...page, rows: page.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }, rowId: row.id };
}

// A tap on physical row `absRow` of the sheet: a row that exists is selected; an empty place below the last row gets a
// new, empty row, with blank rows filling any gap above it. Returns { page, rowId } so the caller can select it.
export function selectRowAt(page, glyphMap, absRow) {
  const owners = lineOwners(page, glyphMap);
  const owner = absRow >= 0 && absRow < owners.length ? owners[absRow] : undefined;
  if (owner === null) return { page, rowId: null }; // the writing space the "write after" option adds: not a row of its own
  if (owner !== undefined) return { page, rowId: page.rows[owner].id };
  const row = newRow();
  const gap = Math.max(0, absRow - owners.length);
  return { page: { ...page, rows: [...page.rows, ...Array.from({ length: gap }, () => newRow({ kind: "blank" })), row] }, rowId: row.id };
}

// Tap on a tile with no row selected: it goes to the first free place, i.e. below the last row.
export function appendTile(page, glyphMap, tile) {
  const base = { ...page, rows: page.rows.filter((r) => !isEmptyRow(r)) };
  return dropTile(base, glyphMap, lineOwners(base, glyphMap).length, tile);
}

// A new editable page from the rows marked "для повторения" (whole rows only in this version).
export function pageFromMarked(sourcePage, title) {
  const rows = (sourcePage?.rows ?? []).filter((r) => r.marked).map((r) => ({ ...r, id: newId("r"), marked: false }));
  if (!rows.length) return null;
  return newPage(title ?? `${sourcePage.title}: повторение`, { ruling: sourcePage.ruling, writeAfter: sourcePage.writeAfter, rows });
}

export function duplicateRow(rows, index) {
  const copy = { ...rows[index], id: newId("r") };
  return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
}

export function moveRow(rows, index, delta) {
  const to = index + delta;
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

// Characters of `text` that no glyph covers (the engine silently skips them; the constructor
// must say so). Same longest-match walk as wideTokenToLabels, so the verdicts agree.
export function findUnsupported(text, glyphMap) {
  const out = [];
  for (const token of String(text ?? "").split(/\s+/).filter(Boolean)) {
    if (token.includes("+") || glyphMap.has(token)) continue;
    let i = 0;
    while (i < token.length) {
      let hit = 0;
      for (let len = Math.min(token.length - i, 4); len >= 1; len -= 1) {
        if (glyphMap.has(token.slice(i, i + len))) { hit = len; break; }
      }
      if (hit) i += hit;
      else { if (!out.includes(token[i])) out.push(token[i]); i += 1; }
    }
  }
  return out;
}

// Characters of `text` that exist but leave the row (capitals, б в д з р у ф ц щ, ! ?): not allowed on the wide
// ruling, where only letters inside the band are written, as in the methodology. Same longest-match walk.
export function findOutsideRow(text, glyphMap) {
  const bad = outsideRowLabels(glyphMap);
  const out = [];
  for (const token of String(text ?? "").split(/\s+/).filter(Boolean)) {
    if (token.includes("+") || glyphMap.has(token)) { if (bad.has(token) && !out.includes(token)) out.push(token); continue; }
    let i = 0;
    while (i < token.length) {
      let hit = 0;
      for (let len = Math.min(token.length - i, 4); len >= 1; len -= 1) {
        if (glyphMap.has(token.slice(i, i + len))) { hit = len; break; }
      }
      if (hit) { const label = token.slice(i, i + hit); if (bad.has(label) && !out.includes(label)) out.push(label); i += hit; } else i += 1;
    }
  }
  return out;
}

// { empty, unsupported: [chars], overflow } for one row. Overflow = the row, written once with no
// multiplying, is wider than the printable line (it would be clipped on the page).
export function analyzeRow(row, glyphMap, ruling = "narrow") {
  const text = String(row?.text ?? "").trim();
  if (row?.kind === "blank") return { empty: false, blank: true, unsupported: [], outside: [], overflow: false };
  if (!text) return { empty: true, unsupported: [], outside: [], overflow: false };
  const unsupported = findUnsupported(text, glyphMap);
  const outside = ruling === "wide" ? findOutsideRow(text, glyphMap) : [];
  if (row?.kind === "passage") {
    // wrapped, so only a single word wider than the line can overflow
    const tooWide = text.split(/\s+/).some((w) => lineWidth(w, glyphMap, ruling) > WIDE_ROW_MAX_X);
    return { empty: false, unsupported, outside, overflow: tooWide };
  }
  let overflow = false;
  if (!unsupported.length || wideTokenToLabels(text.split(/\s+/)[0], glyphMap).length) {
    try {
      const { placed } = layoutWideLinesIntoRows([text], glyphMap, undefined, false, ruling === "narrow" ? 0.5 : 1);
      const width = placed[0]?.segments?.[0]?.width ?? 0;
      overflow = width > WIDE_ROW_MAX_X;
    } catch {
      overflow = false;
    }
  }
  return { empty: false, unsupported, outside, overflow };
}

export function analyzePage(page, glyphMap) {
  const rows = (page?.rows ?? []).map((row) => analyzeRow(row, glyphMap, page?.ruling));
  return {
    rows,
    problems: rows.filter((r) => r.unsupported.length || r.outside?.length || r.overflow).length,
  };
}

// The word under a tap: `rowWord` is the placed row's text (words separated by spaces, possibly the
// same word repeated across the line), `localX` the tap position in the row's own units. Word k is
// where the line written up to word k has not yet reached the tap.
export function pickFragment(rowWord, localX, glyphMap, ruling = "narrow") {
  const words = String(rowWord ?? "").split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  for (let k = 0; k < words.length; k += 1) {
    if (lineWidth(words.slice(0, k + 1).join(" "), glyphMap, ruling) >= localX - 6) return words[k];
  }
  return words[words.length - 1];
}

// ---- sets («комплект»): an ordered list of pages shown and printed as one booklet -------------

export function newSet(title = "Новый комплект", patch = {}) {
  const now = Date.now();
  return { id: newId("st"), title, ruling: "narrow", pageIds: [], createdAt: now, updatedAt: now, ...patch };
}

// All pages of a set as one list of engine lines. Every page is padded with blank rows up to a whole
// number of screen pages, so each page of the set starts on a fresh screen/paper page and the
// engine's own page counter ("Страница k из N") is the set's page number, on screen and on paper.
// The set's ruling applies to all its pages. Pages that no longer exist are skipped.
export function setToLines(set, pagesById, glyphMap) {
  const out = [];
  const ids = (set?.pageIds ?? []).filter((id) => pagesById.get(id));
  ids.forEach((id, k) => {
    const page = { ...pagesById.get(id), ruling: set.ruling ?? pagesById.get(id).ruling };
    const lines = pageToLines(page, glyphMap);
    out.push(...lines);
    if (k < ids.length - 1) {
      const rest = (ROWS_PER_PAGE - (lines.length % ROWS_PER_PAGE)) % ROWS_PER_PAGE;
      for (let i = 0; i < rest; i += 1) out.push("");
    }
  });
  return out;
}

// First screen page number (1-based) of each page in a set, for the editor's "стр. 3" labels.
export function setPageStarts(set, pagesById, glyphMap) {
  const starts = [];
  let screenPage = 1;
  for (const id of set?.pageIds ?? []) {
    const page = pagesById.get(id);
    if (!page) { starts.push(null); continue; }
    starts.push(screenPage);
    const n = pageToLines({ ...page, ruling: set.ruling ?? page.ruling }, glyphMap).length;
    screenPage += Math.max(1, Math.ceil(n / ROWS_PER_PAGE));
  }
  return starts;
}
