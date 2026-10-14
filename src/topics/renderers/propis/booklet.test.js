import { describe, expect, it } from "vitest";
import { bookletPageCount, bookletSheets } from "./booklet.js";

describe("booklet order", () => {
  it("pads to a multiple of 4", () => {
    expect([0, 1, 4, 5, 7, 8, 9, 24].map(bookletPageCount)).toEqual([4, 4, 4, 8, 8, 8, 12, 24]);
  });

  it("8 pages: outer sheet 8|1 and 2|7, inner 6|3 and 4|5", () => {
    expect(bookletSheets(8)).toEqual([
      { front: [7, 0], back: [1, 6] },
      { front: [5, 2], back: [3, 4] },
    ]);
  });

  it("every page once; pages read in order when the stack is folded; odd pages fall on the right", () => {
    for (const n of [1, 3, 4, 6, 9, 13, 24]) {
      const sheets = bookletSheets(n);
      const m = bookletPageCount(n);
      const all = sheets.flatMap((s) => [...s.front, ...s.back]).sort((a, b) => a - b);
      expect(all).toEqual(Array.from({ length: m }, (_, i) => i));
      // page k (0-based) on the right half when k is even: the 1st, 3rd... page of a booklet are right-hand pages
      for (const s of sheets) for (const [l, r] of [s.front, s.back]) { expect(r % 2).toBe(0); expect(l % 2).toBe(1); }
      // the two halves of one side always add up to m - 1 (they are the two ends of one folded sheet)
      for (const s of sheets) { expect(s.front[0] + s.front[1]).toBe(m - 1); expect(s.back[0] + s.back[1]).toBe(m - 1); }
    }
  });
});

describe("the PDF's file name", () => {
  it("the notebook's title, without characters file systems refuse", async () => {
    const { pdfFileName } = await import("./printPdf.js");
    expect(pdfFileName("Мои первые буквы")).toBe("Мои первые буквы.pdf");
    expect(pdfFileName("Буквы: А/Б?")).toBe("Буквы А Б.pdf");
    expect(pdfFileName("  ")).toBe("Тетрадь.pdf");
  });
});
