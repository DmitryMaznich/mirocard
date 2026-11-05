import { describe, it, expect } from "vitest";
import { deckPapers, ownRowGrid, taskGrid, newPage, rowsPerPage } from "./model.js";
import { ownRowsPerPage, snapXFor } from "../propis/PrintPageView.jsx";

// The first two steps of the Mazina method ("Начинаю писать красиво!" №1, №2): papers of the Russian deck (owner, 2026-11-05)
describe("Mazina step 1 / 2 papers", () => {
  it("are offered by the deck without a paper list, after the copybook", () => {
    expect(deckPapers({}).map((g) => g.id)).toEqual(["propis", "m1", "m2", "square", "ruled"]);
    expect(deckPapers({ meta: { papers: ["bg"] } }).map((g) => g.id)).toEqual(["bg"]);
  });
  it("have rows of their own: 22 mm and 14.8 mm cycles, 9 and 13 rows on an A5 page", () => {
    expect(ownRowGrid("m1") && ownRowGrid("m2")).toBe(true);
    expect(ownRowsPerPage("a5", "m1")).toBe(9);
    expect(ownRowsPerPage("a5", "m2")).toBe(13);
    expect(rowsPerPage(newPage("x", { gridKind: "m1" }))).toBe(9);
    expect(taskGrid(newPage("x", { gridKind: "m2" }))).toBe("m2");
  });
  it("lay the letters out at the band's own size: lowercase 8 mm (scale 1) and 5 mm (0.625), on drawn slants", () => {
    const s1 = snapXFor({ narrowRows: true, simpleGrid: "m1", margin: "off", format: "a5", narrow17: true });
    const s2 = snapXFor({ narrowRows: true, simpleGrid: "m2", margin: "off", format: "a5", narrow17: true });
    expect(s1.letterScale).toBeCloseTo(1, 5);
    expect(s2.letterScale).toBeCloseTo(0.625, 5);
    expect(s1.drawn && s2.drawn).toBe(true);
    // the snap puts a start on a slant: a second call from the result stays put
    const x = s1(0, 123.4, 50);
    expect(s1(0, x, 50)).toBeCloseTo(x, 6);
  });
});
