// Saddle-stitch booklet order for «Тетрадью» (PdfPages.jsx) — the same as propis2's
// src/topics/renderers/propis/booklet.js, copied for this topic: the A5 pages two to a side of an A4
// landscape sheet, printed on both sides (flip on the short edge), folded and stapled on the fold;
// padded to a multiple of 4. Each sheet: `front` and `back` = [left, right] 0-based page indices.
export const BOOKLET_MAX_PAGES = 24;
export const bookletPageCount = (count) => Math.max(4, Math.ceil(Math.max(0, count) / 4) * 4);
export function bookletSheets(count) {
  const m = bookletPageCount(count);
  return Array.from({ length: m / 4 }, (_, i) => ({ front: [m - 1 - 2 * i, 2 * i], back: [2 * i + 1, m - 2 - 2 * i] }));
}

export function bookletBlocked(notebook) {
  if ((notebook.format ?? "a4") !== "a5") return "Тетрадью — только формат А5: две страницы на листе А4.";
  if (notebook.pages.length > BOOKLET_MAX_PAGES) return `Тетрадью — до ${BOOKLET_MAX_PAGES} страниц: толще тетрадь плохо складывается и скрепляется. Разделите её на две.`;
  return null;
}

