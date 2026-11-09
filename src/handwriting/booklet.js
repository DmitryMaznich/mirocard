// Saddle-stitch booklet order (`propis2` print «Тетрадью», owner 2026-10-14): the A5 pages go two to a side of an A4 landscape sheet,
// printed on both sides (flip on the SHORT edge), the stack folded in half and stapled on the fold. The same order as the printed
// series (scripts/propis_worksheets/booklet.py `_imposition_order`).
//
// `count` content pages are padded to a multiple of 4 (the extra pages are ruled like the last one, owner: "добивать линованными").
// Returns one entry per sheet, outer sheet first: `front` and `back` are [left, right] 0-based page indices; an index >= `count` is a
// padding page. The cover is not part of it: it is its own outer sheet around these (the front and the back cover outside, white inside).
export const BOOKLET_MAX_PAGES = 24; // more pages fold and staple badly (the inner sheets creep out); owner, 2026-10-14

export const bookletPageCount = (count) => Math.max(4, Math.ceil(Math.max(0, count) / 4) * 4);

export function bookletSheets(count) {
  const m = bookletPageCount(count);
  return Array.from({ length: m / 4 }, (_, i) => ({
    front: [m - 1 - 2 * i, 2 * i],
    back: [2 * i + 1, m - 2 - 2 * i],
  }));
}
