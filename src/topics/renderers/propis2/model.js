// `propis2`: page model and its translation into the line strings the shared wide-row engine
// understands ("И#d" = sample with start dots, "И#c" = clean row, see wordEngine.js).
import { layoutWideLinesIntoRows, wideTokenToLabels, WIDE_ROW_MAX_X } from "../propis/wordEngine.js";
import { dropFlag, DROP_ROW_INDENT_CELLS } from "./dropCap.js";
import { snapXFor, ownRowsPerPage } from "../propis/PrintPageView.jsx";
import { TEXT_ROW_WIDE_DIAGONAL_SPACING, PRINT_ROWS_PER_PAGE, PRINT_PAGE_W_MM, PRINT_PAGE_H_MM, PRINT_FIRST_BASELINE_MM, mmToNativeUnits, propis2MarginUnits } from "../propis/propisRuling.js";
import { outsideRowLabels } from "./glyphReach.js";
import { PROPIS2_METHOD_NOTEBOOKS } from "./data.js";


// Rows on one screen/paper page of the wide-row sheets (ruling row 0 is only the top edge).
export const ROWS_PER_PAGE = PRINT_ROWS_PER_PAGE - 1;

// Page formats: «А5» is the page of the finished copybooks (two on an A4 landscape sheet when printed), «А4» a whole A4
// portrait sheet. Same row cycle (12 mm), so A4 simply has more rows and a wider line.
export const PAGE_FORMATS = [
  { id: "a5", label: "А5 (как в готовых прописях)", wMm: PRINT_PAGE_W_MM, hMm: PRINT_PAGE_H_MM },
  { id: "a4", label: "А4 вертикально", wMm: 210, hMm: 297 },
];
export const pageFormat = (page) => (page?.format === "a4" ? "a4" : "a5");
const formatOf = (page) => PAGE_FORMATS.find((f) => f.id === pageFormat(page));
export const pageAspect = (page) => { const f = formatOf(page); return f.wMm / f.hMm; };
// content rows on one page (ruling row 0 is only the top edge)
// content rows on one page: all ruling rows on the narrow ruling (17 on A5, 24 on A4); on the wide one the first ruling row is only the
// top edge of the first band (16 / 23)
export const rowsPerPage = (page) => (ownRowGrid(taskGrid(page)) ? ownRowsPerPage(pageFormat(page), taskGrid(page)) : Math.floor((formatOf(page).hMm - PRINT_FIRST_BASELINE_MM) / 12) + (page?.ruling === "narrow" ? 1 : 0));

export const RULINGS = [
  { id: "narrow", label: "Узкая строка", short: "Узкая" },
  { id: "wide", label: "Широкая строка", short: "Широкая" },
];

// Slant grid, as in the finished copybooks: "regular" (редкая, стандартная школьная: a line every 20 mm) and
// "dense" (частая: every 2.5 mm on the narrow row, 5 mm on the wide one — the distance between the tops of «и», the letters' own cell). The methodology grid the glyphs snap to is not drawn.
export const GRIDS = [
  { id: "regular", label: "Редкая косая линейка (через 20 мм, стандарт)", short: "Редкая" },
  { id: "dense", label: "Частая косая линейка (через 2,5 мм на узкой строке, 5 мм на широкой)", short: "Частая" },
  // only the rows' horizontal lines (owner, 2026-10-25); the letters stand by the hidden grid, as on the sparse slant
  { id: "none", label: "Без наклонных линий", short: "Без наклонных" },
];

// What kind of paper: the copybook ("прописи", slant grid and row guides), a plain squared page ("клетка", 5 mm)
// or plain ruled paper ("линейка", only the baselines). The slant-grid options (GRIDS, dashes) belong to "propis".
// "bg": the Bulgarian copybook ruling (four lines a row, PrintPageView BG_*), offered only by a deck that lists it in meta.papers.
export const GRID_KINDS = [
  { id: "propis", label: "Прописи" },
  { id: "square", label: "Клетка" },
  { id: "ruled", label: "Линейка" },
  { id: "bg", label: "Болгарская строка" },
];
// Papers with rows of their own (not the 12 mm cycle of the Russian copybook): always on the narrow size, no ruling to choose.
export const ownRowGrid = (grid) => grid === "square" || grid === "ruled" || grid === "bg";
// The papers a deck offers, in order (the first is the paper of a new notebook): meta.papers of a variant deck; the Russian ones else.
const RU_PAPERS = ["propis", "square", "ruled"];
export const deckPapers = (topicRecord) => {
  const ids = topicRecord?.meta?.papers;
  return GRID_KINDS.filter((g) => (Array.isArray(ids) ? ids : RU_PAPERS).includes(g.id)).sort((a, b) => (ids ?? RU_PAPERS).indexOf(a.id) - (ids ?? RU_PAPERS).indexOf(b.id));
};
export const pageGridKind = (page) => page?.gridKind ?? (page?.grid === "square" ? "square" : "propis");
// The grid name the page task / PrintPageView understands.
export const taskGrid = (page) => {
  const kind = pageGridKind(page);
  if (kind !== "propis") return kind;
  return page?.grid === "dense" ? "dense" : page?.grid === "none" ? "none" : "regular";
};
// the Bulgarian paper keeps its own slant (76°) or none: no dense grid of its own
export const pageNoSlant = (page) => page?.grid === "none";
// The middle dash: on the copybook paper in the middles of the rows (on by default, `midDash`); on the Bulgarian paper only in the
// middle of the x-height band, off by default and kept apart (`bgDash`, owner 2026-10-25), so a notebook's two papers don't share it.
export const pageMidDash = (page) => (pageGridKind(page) === "bg" ? Boolean(page?.bgDash) : page?.midDash !== false);

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

// Per-row options (block «Строка»).
//  repeat — what is drawn: "one" (the sample once), "all" (the sample and copies across the whole row), "fade" (copies that
//           fade out towards the middle of the row). A single letter or element is multiplied too, a mixed sequence ("и м")
//           repeats as a whole.
//  dots   — red start dots: "none", "one" (at the sample only), "all" (at every place across the row where a copy starts or
//           would start: with "one" repeat no copies are drawn, the dots alone mark where the child starts writing).
//  copies — "dash" (dashed, default) or "solid" (pale solid).
// Rows from the ready methodology sheets and rows saved before these options existed have no `repeat`: they keep the old
// rule («auto»: only a word or an already repeating group is multiplied; `mark` "d" / "c" = extra dots / clean row).
export const REPEATS = ["all", "one", "fade"];
export const DOTS = ["all", "one", "none"];
export const COPY_STYLES = ["dash", "solid"];
export function rowParams(row) {
  const explicit = REPEATS.includes(row?.repeat);
  return {
    repeat: explicit ? row.repeat : "auto",
    dots: DOTS.includes(row?.dots) ? row.dots : row?.mark === "c" ? "none" : "all",
    copies: COPY_STYLES.includes(row?.copies) ? row.copies : "dash",
  };
}

// Does the engine's own rule (no explicit repeat) multiply this text across the row?
export function multipliesByDefault(text, glyphMap) {
  const toks = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return false;
  if (toks.length === 1) return !glyphMap.has(toks[0]) && wideTokenToLabels(toks[0], glyphMap).length > 1;
  for (let p = 1; p <= toks.length / 2; p += 1) if (toks.length % p === 0 && toks.every((t, i) => t === toks[i % p])) return true;
  return false;
}

export function newRow(patch = {}) {
  return { id: newId("r"), kind: "text", text: "", mark: "", marked: false, repeat: "all", dots: "all", copies: "dash", ...patch };
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
    return newRow({ kind: isElement ? "element" : "text", text, mark: m ? m[2] : "", repeat: "auto", dots: m?.[2] === "c" ? "none" : "all" });
  });
  return newPage(title, { ruling, rows: rows.length ? rows : [newRow()] });
}

// ---- presets: a ready page whose layout (paper, ruling, rows and their options) is closed. A page made from a preset
// is `locked`: only the symbols / words of its rows can be changed, until the page is cleared. ----
export const isLocked = (page) => Boolean(page?.locked);

const PRESET_PAGE_FIELDS = ["ruling", "grid", "gridKind", "midDash", "bgDash", "writeAfter", "margin", "format"];
const copyRows = (rows) => (rows ?? []).map((r) => ({ ...r, id: newId("r"), marked: false }));

export function pageFromPreset(preset, title) {
  const patch = {};
  for (const k of PRESET_PAGE_FIELDS) if (preset[k] !== undefined) patch[k] = preset[k];
  return newPage(title ?? preset.title, { ...patch, rows: copyRows(preset.rows).length ? copyRows(preset.rows) : [newRow()], locked: true, presetId: preset.id });
}

export function presetFromPage(page, title) {
  const out = { id: newId("ps"), title: title || page.title || "Пресет", rows: copyRows(page.rows), createdAt: Date.now(), updatedAt: Date.now() };
  for (const k of PRESET_PAGE_FIELDS) if (page[k] !== undefined) out[k] = page[k];
  return out;
}

// A ready methodology sheet as a built-in preset.
export function presetFromLines(id, title, lines, ruling, elementLabels) {
  const page = pageFromLines(title, lines, ruling, elementLabels);
  return { id, title, ruling: page.ruling, rows: page.rows, builtin: true };
}

// The methodology workbook (wide.json `sheets`) as ready notebooks in the shape of a kit: part 1 on the WIDE ruling, part 2 on the NARROW one.
export function methodNotebooks(sheets, elementLabels) {
  return PROPIS2_METHOD_NOTEBOOKS.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    page: { ruling: m.ruling, grid: "dense", midDash: true },
    pages: m.sheets.filter(([id]) => sheets?.[id]).map(([id, title]) => ({ title, rows: pageFromLines(title, sheets[id], m.ruling, elementLabels).rows })),
  }));
}

// A ready kit (kits.json) as the user's own copy: a set of pages hidden from the plain page list (`kitId` = the set), so a
// 38-page notebook is one entry of the library, not 38. The copy is the user's to change in full: the kit stays the sample
// (owner, 2026-10-15 — closed copies let nothing be changed on a blank notebook, and only the samples' symbols on the others).
export function kitToLibraryItems(kit) {
  const set = newSet(kit.title, { ruling: kit.page?.ruling ?? "narrow", kit: kit.id, sourceId: `kit:${kit.id}` });
  // a page of a kit may have its own paper (`paper`, over the kit's `page`): the digits kit is squared paper, then the copybook ruling
  const pages = kit.pages.map((p) => newPage(p.title, { ...(kit.page ?? {}), ...(p.paper ?? {}), rows: p.rows.length ? p.rows.map((r) => newRow({ ...r })) : [newRow()], kitId: set.id }));
  return { set: { ...set, pageIds: pages.map((x) => x.id) }, pages };
}

// "Clear the page": the layout opens up again, the content goes.
export const clearPage = (page) => ({ ...page, locked: false, presetId: undefined, rows: [newRow()] });

// On a locked page a tapped symbol replaces the symbols of the selected row (nothing grows, no row is added).
export function replaceSymbol(page, selectedId, tile) {
  const idx = page.rows.findIndex((r) => r.id === selectedId);
  if (idx < 0) return page;
  const row = page.rows[idx];
  if (row.kind !== "text" && row.kind !== "element") return page;
  const patch = tile.kind === "element" ? { kind: "element", text: tile.text } : { kind: "text", text: tile.text };
  return { ...page, rows: page.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)) };
}

// Spaces of a sample row: one is the usual gap between symbols, each further space adds a slant cell (the "_N" pseudo token the
// engine understands, as in running text).
const sampleSpacing = (text) => String(text ?? "").trim().replace(/\s+/g, (m) => (m.length > 1 ? ` _${m.length - 1} ` : " "));

export function rowToLine(row) {
  if (row?.kind === "blank") return "";
  const text = sampleSpacing(row?.text);
  if (!text) return "";
  const { repeat, dots, copies } = rowParams(row);
  if (repeat === "auto") {
    // old rule: the sheet's own mark, nothing else (a "solid copies" choice still applies)
    let legacy = row.mark === "d" || row.mark === "c" ? row.mark : "";
    if (dots === "none") legacy = "c"; else if (dots === "one") legacy = "o";
    return `${text}${legacy ? `#${legacy}` : ""}${copies === "solid" ? "#s" : ""}`;
  }
  const flags = [];
  if (repeat === "fade") flags.push("f");
  else if (repeat === "all") flags.push("r");
  else if (dots === "all") flags.push("r", "x"); // one sample, the dots mark every place the child starts
  else flags.push("1");
  if (dots === "none") flags.push("c");
  else if (dots === "one") flags.push("o");
  if (copies === "solid") flags.push("s");
  // `gap`: extra cells between the repeated units of the row (a kit's pairs «Аа»: the pair is told from the next one)
  if (Number(row?.gap) > 0 && (repeat === "all" || repeat === "fade" || dots === "all")) flags.push(`g${Math.min(8, Math.floor(row.gap))}`);
  // `even`: the symbols stand a fixed gap after each other's ink, off the slant grid (wordEngine `#v`, as the alphabet on the cover's
  // back): a kit's pairs «Г г» — counted in cells from the capital's start, a wide capital pushed its lowercase a whole cell further
  if (row?.even) flags.push("v");
  return `${text}${flags.map((f) => `#${f}`).join("")}`;
}

// Margins (red line, alternating on the spread) narrow the row: its widest allowed ink.
export const MARGINS = [
  { id: "off", label: "Без полей" },
  { id: "left", label: "Поля слева на первой странице, дальше чередуются" },
  { id: "right", label: "Поля справа на первой странице, дальше чередуются" },
];
export const pageMargin = (page) => (page?.margin === "left" || page?.margin === "right" ? page.margin : "off");
export const rowMaxX = (page) => WIDE_ROW_MAX_X + (mmToNativeUnits(formatOf(page).wMm) - mmToNativeUnits(PRINT_PAGE_W_MM)) - (pageMargin(page) === "off" ? 0 : propis2MarginUnits());

// Width of a line as the page lays it out: on the page's own grid (`snap` = what snapXFor gives for the page), not freely.
// Widths are asked for again and again (the wrapping of a passage measures every growing prefix, on every key typed): kept per glyph
// set and grid function (pageSnap gives the same function for the same page parameters).
const WIDTH_CACHE = new WeakMap();
const NO_SNAP = {};
const cacheOf = (store, glyphMap, snap) => {
  let bySnap = store.get(glyphMap);
  if (!bySnap) { bySnap = new WeakMap(); store.set(glyphMap, bySnap); }
  let m = bySnap.get(snap ?? NO_SNAP);
  if (!m) { m = new Map(); bySnap.set(snap ?? NO_SNAP, m); }
  if (m.size > 20000) m.clear();
  return m;
};
// `maxX` (optional): the right edge the page allows. Only a closed pattern (a fence) cares: the engine runs it to that edge, so it is
// laid out against the page's own edge, not the default one (otherwise a fence that fills a page with margins read as too wide).
export const lineWidth = (text, glyphMap, ruling, snap, maxX) => {
  const cache = glyphMap ? cacheOf(WIDTH_CACHE, glyphMap, snap) : null;
  const key = `${ruling}|${maxX ?? ""}|${text}`;
  if (cache?.has(key)) return cache.get(key);
  const w = lineWidthNow(text, glyphMap, ruling, snap, maxX);
  cache?.set(key, w);
  return w;
};
const lineWidthNow = (text, glyphMap, ruling, snap, maxX) => {
  const rowSnap = snap ? Object.assign((_row, x, y) => snap(0, x, y), snap.cell ? { cell: { ...snap.cell, origin: () => snap.cell.origin(0) } } : {}, snap.hidden ? { hidden: true } : {}, snap.drawn ? { drawn: true } : {}, snap.letterScale ? { letterScale: snap.letterScale } : {}) : undefined;
  const { placed } = layoutWideLinesIntoRows([text], glyphMap, rowSnap, false, ruling === "narrow" ? 0.5 : 1, maxX);
  return placed[0]?.segments?.[0]?.width ?? 0;
};

// The snapping function of a page: the grid it is drawn with (slant frequency), margin, format.
export const pageSnap = (page) => snapXFor({ narrowRows: pageRuling(page) === "narrow", simpleGrid: taskGrid(page), margin: pageMargin(page), format: pageFormat(page), narrow17: pageRuling(page) === "narrow" });
// The row size the layout uses: squared paper has no copybook ruling of its own, its letters and digits are laid out at the narrow size.
// ruled paper too (its own 8 mm rows, PrintPageView OWN_ROWS)
export const pageRuling = (page) => (ownRowGrid(taskGrid(page)) ? "narrow" : page?.ruling);
// Rows of different pages stand at different phases of the grid: keep one cell of room so a snapped line never runs off.
const wrapSlack = (ruling) => TEXT_ROW_WIDE_DIAGONAL_SPACING * (ruling === "narrow" ? 0.5 : 1);

// Spaces typed before running text: the text starts that many slant cells in (a cell is 5 mm on the wide ruling, 2.5 on the narrow).
export const leadingSpaces = (text) => (/^\s*/.exec(String(text ?? ""))?.[0].length ?? 0);
export const indentUnitsOf = (text, ruling) => leadingSpaces(text) * TEXT_ROW_WIDE_DIAGONAL_SPACING * (ruling === "narrow" ? 0.5 : 1);

// Greedy wrap of running text into lines that fit the printable width. A single word wider than
// the line stays on its own line (the editor warns about it); nothing is cut.
const WRAP_CACHE = new WeakMap();
export function wrapPassage(text, glyphMap, ruling = "narrow", maxX = WIDE_ROW_MAX_X, indentUnits = 0, snap) {
  const cache = glyphMap ? cacheOf(WRAP_CACHE, glyphMap, snap) : null;
  const key = `${ruling}|${maxX}|${indentUnits}|${text}`;
  if (cache?.has(key)) return cache.get(key);
  const lines = wrapPassageNow(text, glyphMap, ruling, maxX, indentUnits, snap);
  cache?.set(key, lines);
  return lines;
}
function wrapPassageNow(text, glyphMap, ruling, maxX, indentUnits, snap) {
  // words with the extra spaces typed before them: one space is the usual gap between words, every further space adds a
  // slant cell (an "_N" pseudo word for the engine); spaces at the start of the text are the row's indent, not a gap
  const words = [];
  for (const m of String(text ?? "").matchAll(/(\s*)(\S+)/g)) words.push({ word: m[2], extra: words.length ? Math.max(0, m[1].length - 1) : 0 });
  const lines = [];
  let cur = "";
  for (const { word, extra } of words) {
    const cand = cur ? `${cur}${extra ? ` _${extra} ` : " "}${word}` : word;
    if (!cur || lineWidth(cand, glyphMap, ruling, snap) <= maxX - wrapSlack(ruling) - (lines.length === 0 ? indentUnits : 0)) cur = cand;
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
  const rows = page?.rows ?? [];
  // a printed letter (`row.drop`, dropCap.js) stands in the margin when the page has one; without a margin it takes the start of its own row,
  // and the row's ink starts further in (`#iN`, as for the spaces an adult typed before a text)
  rows.forEach((row, ri) => {
    // only on the first of the rows that follow each other with the same letter
    const letter = row.drop && row.drop !== rows[ri - 1]?.drop ? row.drop : "";
    const tag = dropFlag(letter);
    const shift = dropShift(page, ri);
    const indentTag = shift ? `#i${shift}` : "";
    if (row.kind === "blank") { out.push(tag); return; }
    if (row.kind === "passage") {
      const wrapped = glyphMap ? wrapPassage(row.text, glyphMap, pageRuling(page), rowMaxX(page), indentUnitsOf(row.text, pageRuling(page)) + dropShiftUnits(page, ri), pageSnap(page)) : String(row.text ?? "").trim() ? [String(row.text).trim()] : [];
      if (!wrapped.length) { out.push(tag); return; }
      const indent = leadingSpaces(row.text) + shift;
      wrapped.forEach((l, k) => { out.push(`${l}#1${k === 0 && indent ? `#i${indent}` : ""}${k === 0 ? tag : ""}`); if (page?.writeAfter) out.push(""); });
      return;
    }
    const line = rowToLine(row);
    // a row with no text yet still takes its place on the sheet (a ruled, empty row), so it can be selected and filled
    if (!line) { out.push(tag); return; }
    out.push(`${line}${indentTag}${tag}`);
    if (page?.writeAfter) out.push("");
  });
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
      const n = glyphMap ? wrapPassage(row.text, glyphMap, pageRuling(page), rowMaxX(page), indentUnitsOf(row.text, pageRuling(page)) + dropShiftUnits(page, i), pageSnap(page)).length : String(row.text ?? "").trim() ? 1 : 0;
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

// ---- the row strip's settings over several rows (owner, 2026-10-24) ----
// The options a new row takes from the row above it (typed with Enter in fieldText.js, or a tap on an empty place of the sheet).
export const INHERITED_ROW_KEYS = ["repeat", "dots", "copies", "mark", "asText", "gap"];
export const inheritedRowParams = (row) => Object.fromEntries(INHERITED_ROW_KEYS.filter((k) => row?.[k] !== undefined).map((k) => [k, row[k]]));
// «Повтор бледной линией» in the strip = repeat "all" + copies "solid"
export const SOLID_REPEAT = "all-solid";
// A row with a sample: the rows the strip's «Образец» and «Точки» work on (blank rows and running text have neither).
export const isSampleRow = (row) => (row?.kind === "text" || row?.kind === "element") && Boolean(String(row?.text ?? "").trim());
// A row's setting as the strip shows it: `repeat` (a strip choice, the engine's own rule resolved) or `dots`.
export function rowSetting(row, key, glyphMap) {
  const p = rowParams(row);
  if (key === "dots") return p.dots;
  const rep = p.repeat === "auto" ? (multipliesByDefault(row?.text, glyphMap) ? "all" : "one") : p.repeat;
  return rep === "all" && p.copies === "solid" ? SOLID_REPEAT : rep;
}
// The rows below row `index` that are set as it was (`old`): the sample rows down to the first one set otherwise — that one the
// adult set on purpose and it stays; blank and running-text rows are passed over. On this page only. Ids, in order.
export function followingSameRows(rows, index, key, old, glyphMap) {
  const out = [];
  for (let i = index + 1; i < rows.length; i += 1) {
    if (!isSampleRow(rows[i])) continue;
    if (rowSetting(rows[i], key, glyphMap) !== old) break;
    out.push(rows[i].id);
  }
  return out;
}
// Which row settings differ between the sample rows of the page (the dot on a strip button): { repeat: true, dots: true }
export function mixedRowSettings(rows, glyphMap) {
  const out = {};
  const samples = rows.filter(isSampleRow);
  for (const key of ["repeat", "dots"]) if (new Set(samples.map((r) => rowSetting(r, key, glyphMap))).size > 1) out[key] = true;
  return out;
}

// A tap on physical row `absRow` of the sheet: a row that exists is selected; an empty place below the last row gets a
// new, empty row, with blank rows filling any gap above it. Returns { page, rowId } so the caller can select it.
export function selectRowAt(page, glyphMap, absRow) {
  const owners = lineOwners(page, glyphMap);
  const owner = absRow >= 0 && absRow < owners.length ? owners[absRow] : undefined;
  if (owner === null) return { page, rowId: null }; // the writing space the "write after" option adds: not a row of its own
  if (owner !== undefined) return { page, rowId: page.rows[owner].id };
  // the new row takes the options of the last row with something on it (as a row typed with Enter does)
  const above = [...page.rows].reverse().find((r) => String(r.text ?? "").trim());
  const row = newRow(above ? inheritedRowParams(above) : {});
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

// A printed letter (`row.drop`, dropCap.js) put on / taken off a row. Nothing else on the page changes: the margin stays the adult's own choice.
export function withRowDrop(page, rowId, letter) {
  const rows = (page?.rows ?? []).map((r) => {
    if (r.id !== rowId) return r;
    const { drop, ...rest } = r;
    return letter ? { ...rest, drop: letter } : rest;
  });
  return { ...page, rows };
}

// How many slant cells the ink of row `ri` starts further in because a printed letter stands at the start of the row: only without a margin
// (with one the letter stands in it), only on the first of the rows that follow each other with the same letter.
export function dropShift(page, ri) {
  const rows = page?.rows ?? [];
  const row = rows[ri];
  if (!row?.drop || row.drop === rows[ri - 1]?.drop) return 0;
  return pageMargin(page) === "off" && pageHasDropRows(page) ? DROP_ROW_INDENT_CELLS : 0;
}
const dropShiftUnits = (page, ri) => dropShift(page, ri) * TEXT_ROW_WIDE_DIAGONAL_SPACING * (pageRuling(page) === "narrow" ? 0.5 : 1);

// Can the page show a printed letter: the narrow ruling of the methodology paper (the frame is the height of a written capital on it)
export const pageHasDropRows = (page) => pageRuling(page) === "narrow" && pageGridKind(page) === "propis";

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
    if ((token.includes("+") && !token.includes("№")) || glyphMap.has(token)) continue;
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
export function analyzeRow(row, glyphMap, ruling = "narrow", maxX = WIDE_ROW_MAX_X, snap) {
  const text = String(row?.text ?? "").trim();
  if (row?.kind === "blank") return { empty: false, blank: true, unsupported: [], outside: [], overflow: false };
  if (!text) return { empty: true, unsupported: [], outside: [], overflow: false };
  const unsupported = findUnsupported(text, glyphMap);
  const outside = ruling === "wide" ? findOutsideRow(text, glyphMap) : [];
  if (row?.kind === "passage") {
    // wrapped, so only a single word wider than the line can overflow
    const tooWide = text.split(/\s+/).some((w) => lineWidth(w, glyphMap, ruling, snap) > maxX);
    return { empty: false, unsupported, outside, overflow: tooWide };
  }
  let overflow = false;
  if (!unsupported.length || wideTokenToLabels(text.split(/\s+/)[0], glyphMap).length) {
    try {
      overflow = lineWidth(text, glyphMap, ruling, snap, maxX) > maxX;
    } catch {
      overflow = false;
    }
  }
  return { empty: false, unsupported, outside, overflow };
}

export function analyzePage(page, glyphMap) {
  const rows = (page?.rows ?? []).map((row) => analyzeRow(row, glyphMap, pageRuling(page), rowMaxX(page), pageSnap(page)));
  return {
    rows,
    problems: rows.filter((r) => r.unsupported.length || r.outside?.length || r.overflow).length,
  };
}

// The word under a tap: `rowWord` is the placed row's text (words separated by spaces, possibly the
// same word repeated across the line), `localX` the tap position in the row's own units. Word k is
// where the line written up to word k has not yet reached the tap.
export function pickFragment(rowWord, localX, glyphMap, ruling = "narrow") {
  const words = String(rowWord ?? "").split(/\s+/).filter((w) => w && !/^_\d+$/.test(w));
  if (words.length <= 1) return words[0] ?? "";
  for (let k = 0; k < words.length; k += 1) {
    if (lineWidth(words.slice(0, k + 1).join(" "), glyphMap, ruling) >= localX - 6) return words[k];
  }
  return words[words.length - 1];
}

// ---- sets («тетрадь»): an ordered list of pages shown and printed as one notebook -------------

// The paper of a page: format, paper type, ruling, slant, margins, the middle dash, write-after. Since 2026-10-08 every page of a
// notebook («тетрадь») has its OWN paper (a digits notebook: squared pages, then copybook pages with digits in the text); only the
// format (A4 / A5) is the notebook's, because the pages are printed as one booklet. A new page takes the paper of the page it is added
// after; a setting changed on one page can be put onto all the pages of the notebook (the editor offers it right after).
export const LAYOUT_KEYS = ["format", "gridKind", "ruling", "grid", "midDash", "bgDash", "writeAfter", "margin"];
export const NOTEBOOK_KEYS = ["format"];
export const PAGE_PAPER_KEYS = LAYOUT_KEYS.filter((k) => !NOTEBOOK_KEYS.includes(k));

// What the notebook imposes on each of its pages: the keys of NOTEBOOK_KEYS, taken from its first page.
export function notebookLayout(set, pagesById) {
  const first = pagesById.get(set?.pageIds?.[0]);
  const out = {};
  for (const k of NOTEBOOK_KEYS) if (first && first[k] !== undefined) out[k] = first[k];
  return out;
}

// One string per paper as the engine draws it (defaults filled in), to tell whether two pages are on the same paper. «Писать после»
// is not paper for the engine (it adds blank lines), so pages that differ only in it stay in one run.
export const paperKey = (page) => JSON.stringify([pageFormat(page), taskGrid(page), pageNoSlant(page), ownRowGrid(taskGrid(page)) ? "" : page?.ruling === "narrow" ? "narrow" : "wide", pageMidDash(page), pageMargin(page)]);

// Each page setting of the editor's strip as the strip shows it (defaults filled in). The ruling and middle dash mean something
// on the copybook paper only, the slant on it and on the Bulgarian paper (there only «Редкая» / «Без наклонных»), so only those pages count.
const SETTING_OF = {
  gridKind: pageGridKind,
  ruling: (p) => (p?.ruling === "wide" ? "wide" : "narrow"),
  grid: (p) => (p?.grid === "none" ? "none" : p?.grid === "dense" && pageGridKind(p) === "propis" ? "dense" : "regular"),
  margin: pageMargin,
  midDash: (p) => p?.midDash !== false,
  bgDash: (p) => Boolean(p?.bgDash),
  writeAfter: (p) => Boolean(p?.writeAfter),
};
const COPYBOOK_ONLY = new Set(["ruling", "grid", "midDash"]);
export const SLANT_PAPERS = new Set(["propis", "bg"]);
const countsFor = (key, page) => (key === "bgDash" ? pageGridKind(page) === "bg" : !COPYBOOK_ONLY.has(key) || (key === "grid" ? SLANT_PAPERS : new Set(["propis"])).has(pageGridKind(page)));

// Which settings differ between the pages of the notebook (the dot on a strip button, owner 2026-10-15): { key: true }.
export function mixedSettings(set, pagesById) {
  const pages = (set?.pageIds ?? []).map((id) => pagesById.get(id)).filter(Boolean);
  const out = {};
  for (const [k, of] of Object.entries(SETTING_OF)) {
    const vals = new Set(pages.filter((p) => countsFor(k, p)).map(of));
    if (vals.size > 1) out[k] = true;
  }
  return out;
}

// Would `value` of setting `key` change any page of the notebook but `pageId`? (then the editor offers it for the whole notebook)
export function othersDiffer(set, pagesById, pageId, key, value) {
  const of = SETTING_OF[key];
  if (!of) return false;
  return (set?.pageIds ?? []).some((id) => {
    const p = pagesById.get(id);
    if (!p || id === pageId || !countsFor(key, p)) return false;
    return of(p) !== of({ ...p, [key]: value });
  });
}

// The notebook in runs of consecutive pages on the same paper («участки»). The student view lays out each run on its own paper;
// a notebook on one paper is one run, laid out as one document exactly as before. `pages`: how many screen pages each run is
// expected to take (from the line count, see setPageStarts), `start`: the screen page the run starts on (0-based).
export function notebookSections(set, pagesById, glyphMap) {
  const out = [];
  for (const id of set?.pageIds ?? []) {
    const page = pagesById.get(id);
    if (!page) continue;
    const key = paperKey(page);
    const last = out[out.length - 1];
    if (last && last.key === key) last.pageIds.push(id);
    else out.push({ key, paper: page, pageIds: [id] });
  }
  let start = 0;
  for (const sec of out) {
    sec.start = start;
    sec.pages = sec.pageIds.reduce((n, id) => n + screenPagesOf(pagesById.get(id), glyphMap), 0);
    start += sec.pages;
  }
  return out;
}

// The lines of a page as the notebook counts them: without the blank row «Писать» adds after the LAST row. It is not content (the engine drops
// a blank end of the sheet anyway), but on a page whose last row stands on the last line it fell onto the next sheet: the preview and the PDF
// then had a blank page after it, which the editor never showed (2026-10-29).
export function pageLinesCounted(page, glyphMap) {
  const lines = pageToLines(page, glyphMap);
  if (page?.writeAfter && lines.length && lineOwners(page, glyphMap)[lines.length - 1] === null) lines.pop();
  return lines;
}

export const screenPagesOf = (page, glyphMap) => Math.max(1, Math.ceil(pageLinesCounted(page, glyphMap).length / rowsPerPage(page)));

// The part of `next` that differs from `prev` in the notebook-wide keys.
export function layoutChange(prev, next) {
  const patch = {};
  for (const k of LAYOUT_KEYS) if (prev[k] !== next[k]) patch[k] = next[k];
  return patch;
}

export function newSet(title = "Новая тетрадь", patch = {}) {
  const now = Date.now();
  return { id: newId("st"), title, ruling: "narrow", pagePaper: true, pageIds: [], createdAt: now, updatedAt: now, ...patch };
}

// Pages of a set as one list of engine lines (all of them, or only `ids`, the pages of one run on the same paper). Every page is
// padded with blank rows up to a whole number of screen pages, so each page of the set starts on a fresh screen/paper page and the
// engine's own page counter is the set's page number, on screen and on paper. Each page on its own paper. Pages that no longer
// exist are skipped.
export function setToLines(set, pagesById, glyphMap, ids = set?.pageIds ?? []) {
  const out = [];
  const pages = ids.map((id) => pagesById.get(id)).filter(Boolean);
  pages.forEach((page, k) => {
    const lines = pageLinesCounted(page, glyphMap);
    out.push(...lines);
    if (k < pages.length - 1) {
      const rpp = rowsPerPage(page);
      const rest = (rpp - (lines.length % rpp)) % rpp;
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
    screenPage += screenPagesOf(page, glyphMap);
  }
  return starts;
}
