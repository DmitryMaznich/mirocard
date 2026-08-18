import { dictationPath, mirrorPaths, translatePaths, pathToD } from "./symmetryDrawGeometry";

// Builds the print document, rendered into a separate browser tab (see
// openSymmetryDrawPrintWindow below and the print-route handling in
// main.jsx) rather than mounted into the app's own React tree.
//
// History of what didn't work, in order, all on real Android Chrome:
// 1. Same-document React portal + `@media print` toggle: the
//    `afterprint`-triggered unmount raced the browser's print capture of
//    that DOM subtree and produced blank pages.
// 2. window.open("about:blank") + document.write(), loading a Google Fonts
//    stylesheet and the logo via <img src>: print preview generation hung
//    forever on "Preparing preview..." — Android waits for every resource
//    referenced in <head>/<img> before it can render a snapshot, and a
//    slow/failed fetch blocks it indefinitely.
// 3. Same tab-opening mechanism with a blob: URL instead of about:blank
//    (no external resources at all): Android's print integration appears
//    to reject blob: URLs outright — printing failed immediately with a
//    generic error.
// The current approach opens a real same-origin https:// URL (a route
// within this same app, see main.jsx) — the one thing every print
// integration is guaranteed to support, since it's just a normal page.

const ARROW_BY_DIRECTION = {
  up: "↑", down: "↓", left: "←", right: "→",
  up_right: "↗", down_right: "↘", up_left: "↖", down_left: "↙",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decorationMarkup(decoration) {
  if (decoration.type === "rect") {
    return `<rect class="sdp-deco" x="${decoration.col}" y="${decoration.row}" width="${decoration.width ?? 1}" height="${decoration.height ?? 1}" />`;
  }
  if (decoration.type === "polygon") {
    return `<path class="sdp-deco" d="${pathToD(decoration.points)} Z" />`;
  }
  return `<circle class="sdp-deco-dot" cx="${decoration.col}" cy="${decoration.row}" r="0.14" />`;
}

function gridLinesMarkup(columns, rows) {
  let markup = "";
  for (let c = 0; c <= columns; c += 1) {
    markup += `<line class="sdp-grid-line" x1="${c}" y1="0" x2="${c}" y2="${rows}" />`;
  }
  for (let r = 0; r <= rows; r += 1) {
    markup += `<line class="sdp-grid-line" x1="0" y1="${r}" x2="${columns}" y2="${r}" />`;
  }
  return markup;
}

function dictationPageMarkup(card) {
  const points = dictationPath(card.start, card.commands);
  const thumb = `
    <svg class="sdp-thumb-svg" viewBox="-0.5 -0.5 ${card.columns + 1} ${card.rows + 1}">
      <path class="sdp-thumb-path" d="${pathToD(points)}" />
      ${(card.decorations ?? []).map(decorationMarkup).join("")}
    </svg>`;
  const instructions = card.commands
    .map((command) => `<span class="sdp-instr">${command.cells}${ARROW_BY_DIRECTION[command.direction]}</span>`)
    .join("");
  return `
    <section class="sdp-page sdp-page--dictation">
      <h2 class="sdp-title">${escapeHtml(card.label)}</h2>
      <div class="sdp-dict-top">
        <div class="sdp-dict-thumb">${thumb}</div>
        <div class="sdp-dict-instructions">${instructions}</div>
      </div>
      <div class="sdp-dict-grid" style="--sdp-cols:${card.columns};--sdp-rows:${card.rows}">
        <svg viewBox="0 0 ${card.columns} ${card.rows}" preserveAspectRatio="xMinYMin meet">
          ${gridLinesMarkup(card.columns, card.rows)}
          <circle class="sdp-start-dot" cx="${card.start.col}" cy="${card.start.row}" r="0.16" />
        </svg>
      </div>
    </section>`;
}

function stripMarkup(card) {
  const isRepeat = card.taskKind === "repeat";
  const targetPaths = isRepeat ? translatePaths(card.sourcePaths, card.axisCol) : mirrorPaths(card.sourcePaths, card.axisCol);
  const thumbPaths = [...card.sourcePaths, ...targetPaths]
    .map((path) => `<path class="sdp-thumb-path" d="${pathToD(path)}" />`)
    .join("");
  const sourcePaths = card.sourcePaths
    .map((path) => `<path class="sdp-source-path" d="${pathToD(path)}" />`)
    .join("");
  const axisClass = isRepeat ? "sdp-repeat-axis" : "sdp-mirror-axis";
  return `
    <div class="sdp-strip">
      <div class="sdp-strip-thumb">
        <svg viewBox="-0.5 -0.5 ${card.columns + 1} ${card.rows + 1}">${thumbPaths}</svg>
      </div>
      <div class="sdp-strip-grid" style="--sdp-cols:${card.columns};--sdp-rows:${card.rows}">
        <svg viewBox="0 0 ${card.columns} ${card.rows}" preserveAspectRatio="xMinYMin meet">
          ${gridLinesMarkup(card.columns, card.rows)}
          ${sourcePaths}
          <line class="${axisClass}" x1="${card.axisCol}" y1="0.15" x2="${card.axisCol}" y2="${card.rows - 0.15}" />
        </svg>
      </div>
    </div>`;
}

function watermarkMarkup() {
  return `<div class="sdp-watermark" aria-hidden="true">${"<span>Mironium</span>".repeat(24)}</div>`;
}

// Inlined directly (not <img src="...">) so the print document has zero
// external/same-origin resource fetches — an <img> or <link> that stalls
// (slow network, DNS hiccup) blocks Android's print-preview generation
// indefinitely (observed: "Preparing preview..." hangs forever). Kept in
// sync by hand with public/brand/mironium-logo.svg.
const MIRONIUM_LOGO_SVG = `<svg class="sdp-footer-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 15 320 60" fill="none"><title>Mironium</title><g transform="translate(2 19) scale(.115)"><path d="M 98.0 0.0 L 376.0 0.0 L 401.0 5.0 L 401.0 7.0 L 388.0 12.0 L 382.0 20.0 L 379.0 17.0 L 369.0 15.0 L 342.0 24.0 L 319.0 23.0 L 291.0 29.0 L 291.0 31.0 L 297.0 29.0 L 313.0 29.0 L 313.0 31.0 L 279.0 41.0 L 229.0 67.0 L 219.0 67.0 L 209.0 61.0 L 215.0 69.0 L 233.0 71.0 L 245.0 67.0 L 265.0 55.0 L 268.0 56.0 L 247.0 71.0 L 204.0 88.0 L 198.0 96.0 L 196.0 112.0 L 200.0 102.0 L 209.0 93.0 L 219.0 91.0 L 206.0 102.0 L 199.0 125.0 L 188.0 136.0 L 200.0 132.0 L 194.0 142.0 L 193.0 151.0 L 201.0 143.0 L 198.0 156.0 L 203.0 167.0 L 206.0 148.0 L 209.0 147.0 L 207.0 151.0 L 209.0 155.0 L 216.0 150.0 L 213.0 159.0 L 214.0 200.0 L 212.0 206.0 L 196.0 224.0 L 176.0 236.0 L 171.0 245.0 L 173.0 255.0 L 191.0 273.0 L 190.0 284.0 L 185.0 289.0 L 186.0 296.0 L 197.0 303.0 L 198.0 310.0 L 209.0 311.0 L 213.0 309.0 L 215.0 311.0 L 212.0 316.0 L 199.0 317.0 L 194.0 322.0 L 195.0 331.0 L 202.0 338.0 L 204.0 344.0 L 203.0 365.0 L 205.0 375.0 L 214.0 386.0 L 224.0 390.0 L 274.0 390.0 L 294.0 396.0 L 304.0 406.0 L 311.0 421.0 L 316.0 440.0 L 92.0 440.0 L 75.0 435.0 L 54.0 422.0 L 42.0 408.0 L 35.0 395.0 L 30.0 374.0 L 31.0 61.0 L 40.0 36.0 L 59.0 15.0 L 77.0 5.0 Z" fill="#1C3634"/></g><text x="57" y="64" fill="#1C3634" font-family="Georgia, serif" font-size="54" letter-spacing="-3">Mironi<tspan fill="#C18B22" font-size="58" font-style="italic" dx="-2">u</tspan><tspan dx="-2">m</tspan></text></svg>`;

function footerMarkup() {
  return `
    <div class="sdp-footer">
      ${MIRONIUM_LOGO_SVG}
      <span class="sdp-footer-tag">Ваш ребёнок может больше · mironium.com</span>
    </div>`;
}

export const PRINT_STYLE = `
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; }
@page { size: A4 portrait; margin: 15mm 12mm 20mm 12mm; }

.sdp-page { break-after: page; break-inside: avoid; }
/* All .sdp-page elements are the only <section> tags in the document (the
   watermark and footer are <div>s), so :last-of-type reliably finds the true
   last page even though the footer div is the document's actual last child. */
.sdp-page:last-of-type { break-after: auto; }

.sdp-page--dictation { display: flex; flex-direction: column; height: 100%; }

.sdp-title { font: 700 16pt -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e3a6e; text-align: center; margin: 0 0 4mm; }

.sdp-dict-top { display: flex; gap: 6mm; align-items: flex-start; flex: 0 0 auto; }

.sdp-dict-thumb { flex: 0 0 35mm; border: 0.4mm dashed #bbb; border-radius: 3mm; padding: 2mm; }
.sdp-thumb-svg { width: 100%; display: block; }
.sdp-thumb-path { fill: none; stroke: #1e3a6e; stroke-width: 0.12; }
.sdp-deco { fill: none; stroke: #1e3a6e; stroke-width: 0.09; }
.sdp-deco-dot { fill: #1e3a6e; }

.sdp-dict-instructions {
  flex: 1; display: flex; flex-wrap: wrap; gap: 2mm 4mm; align-content: flex-start;
  border: 0.3mm solid #ccc; border-radius: 3mm; padding: 3mm;
}
.sdp-instr { font: 700 11pt -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #285da8; }

.sdp-dict-grid, .sdp-strip-grid {
  width: calc(var(--sdp-cols) * 7mm); height: calc(var(--sdp-rows) * 7mm); max-width: 100%;
}
.sdp-dict-grid { margin-top: 6mm; }
.sdp-dict-grid svg, .sdp-strip-grid svg { width: 100%; height: 100%; display: block; }

.sdp-grid-line { stroke: #bcd4ee; stroke-width: 1px; vector-effect: non-scaling-stroke; }
.sdp-start-dot { fill: #2563eb; }
.sdp-source-path { fill: none; stroke: #1e3a6e; stroke-width: 0.12; }
.sdp-mirror-axis { stroke: #e8664f; stroke-width: 0.05; stroke-dasharray: 0.08 0.08; }
.sdp-repeat-axis { stroke: #0d9488; stroke-width: 0.05; }

.sdp-page--strips { display: flex; flex-direction: column; gap: 5mm; }
.sdp-strip { display: flex; gap: 5mm; align-items: center; border: 0.3mm solid #ccc; border-radius: 3mm; padding: 3mm; break-inside: avoid; }
.sdp-strip-thumb { flex: 0 0 25mm; }
.sdp-strip-grid { flex: 0 0 auto; }

.sdp-watermark {
  position: fixed; inset: 0; z-index: -1; display: flex; flex-wrap: wrap;
  align-content: space-evenly; justify-content: space-evenly;
  transform: rotate(-28deg) scale(1.4); opacity: 0.06; pointer-events: none;
}
.sdp-watermark span { font: italic 700 13pt Georgia, serif; color: #1C3634; white-space: nowrap; margin: 6mm 8mm; }

.sdp-footer {
  position: fixed; bottom: 6mm; left: 12mm; right: 12mm;
  display: flex; align-items: center; justify-content: center; gap: 3mm;
  border-top: 0.3mm solid #eee; padding-top: 2mm;
}
.sdp-footer-logo { height: 6mm; width: auto; }
.sdp-footer-tag { font: 700 7pt -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1C3634; letter-spacing: 0.02em; }
`;

export function buildSymmetryDrawPrintBody(cards) {
  const dictationCards = cards.filter((card) => card.taskKind === "dictation");
  const stripCards = cards.filter((card) => card.taskKind !== "dictation");

  return [
    watermarkMarkup(),
    dictationCards.map(dictationPageMarkup).join(""),
    stripCards.length > 0
      ? `<section class="sdp-page sdp-page--strips">${stripCards.map(stripMarkup).join("")}</section>`
      : "",
    footerMarkup(),
  ].join("");
}

export const SYMMETRY_DRAW_PRINT_ROUTE = "/print/symmetry-draw";
export const SYMMETRY_DRAW_PRINT_STORAGE_KEY = "symmetryDrawPrintCards";

// Opens the print route in a new tab with the selected cards handed off via
// sessionStorage (window.open can't pass structured data directly). A real
// same-origin https:// URL — not blob:/about:blank — is the one thing every
// platform's print integration is guaranteed to support; see the file-level
// comment above for what was tried and rejected before landing here.
export function openSymmetryDrawPrintWindow(cards) {
  try {
    sessionStorage.setItem(SYMMETRY_DRAW_PRINT_STORAGE_KEY, JSON.stringify(cards));
  } catch {
    return false;
  }
  const win = window.open(SYMMETRY_DRAW_PRINT_ROUTE, "_blank");
  return Boolean(win);
}
