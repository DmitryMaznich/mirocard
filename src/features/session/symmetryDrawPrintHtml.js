import { dictationPath, mirrorPaths, translatePaths, pathToD } from "./symmetryDrawGeometry";
import { mironiumLogoSvg } from "@/shared/brand/mironiumLogo.js";

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
  const sourcePaths = card.sourcePaths ?? [];
  const targetPaths = isRepeat ? translatePaths(sourcePaths, card.axisCol) : mirrorPaths(sourcePaths, card.axisCol);
  const sourceDots = card.sourceDots ?? [];
  const targetDots = sourceDots.map((point) => isRepeat
    ? { col: point.col + card.axisCol, row: point.row }
    : { col: card.axisCol * 2 - point.col, row: point.row });
  const sourceCircles = card.sourceCircles ?? [];
  const targetCircles = sourceCircles.map((circle) => ({
    ...circle,
    col: isRepeat ? circle.col + card.axisCol : card.axisCol * 2 - circle.col,
  }));
  const thumbPaths = [...sourcePaths, ...targetPaths]
    .map((path) => `<path class="sdp-thumb-path" d="${pathToD(path)}" />`)
    .join("");
  const thumbDots = [...sourceDots, ...targetDots]
    .map((point) => `<circle class="sdp-thumb-dot" cx="${point.col}" cy="${point.row}" r="0.06" />`)
    .join("");
  const thumbCircles = [...sourceCircles, ...targetCircles]
    .map((circle) => `<circle class="sdp-thumb-circle" cx="${circle.col}" cy="${circle.row}" r="${circle.diameter / 2}" />`)
    .join("");
  const sourcePathMarkup = sourcePaths
    .map((path) => `<path class="sdp-source-path" d="${pathToD(path)}" />`)
    .join("");
  const sourceDotMarkup = sourceDots
    .map((point) => `<circle class="sdp-source-dot" cx="${point.col}" cy="${point.row}" r="0.06" />`)
    .join("");
  const sourceCircleMarkup = sourceCircles
    .map((circle) => `<circle class="sdp-source-circle" cx="${circle.col}" cy="${circle.row}" r="${circle.diameter / 2}" />`)
    .join("");
  const axisClass = isRepeat ? "sdp-repeat-axis" : "sdp-mirror-axis";
  return `
    <div class="sdp-strip">
      <div class="sdp-strip-thumb">
        <svg viewBox="-0.5 -0.5 ${card.columns + 1} ${card.rows + 1}">${thumbPaths}${thumbDots}${thumbCircles}</svg>
      </div>
      <div class="sdp-strip-grid" style="--sdp-cols:${card.columns};--sdp-rows:${card.rows}">
        <svg viewBox="0 0 ${card.columns} ${card.rows}" preserveAspectRatio="xMinYMin meet">
          ${gridLinesMarkup(card.columns, card.rows)}
          ${sourcePathMarkup}
          ${sourceDotMarkup}
          ${sourceCircleMarkup}
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
// indefinitely (observed: "Preparing preview..." hangs forever).
const MIRONIUM_LOGO_SVG = mironiumLogoSvg({ className: "sdp-footer-logo", font: "Georgia, serif" });

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
.sdp-thumb-dot { fill: #1e3a6e; }
.sdp-thumb-circle { fill: none; stroke: #1e3a6e; stroke-width: 0.12; }
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
.sdp-source-dot { fill: #1e3a6e; }
.sdp-source-circle { fill: none; stroke: #1e3a6e; stroke-width: 0.12; }
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
