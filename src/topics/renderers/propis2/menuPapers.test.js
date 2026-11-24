import { describe, it, expect } from "vitest";
import { menuPapers } from "./model.js";
import { fourLinePaper } from "@/handwriting/fourLinePapers.js";

const list = (ids) => ids.map((id) => ({ id }));
const ids = (papers) => papers.map((g) => g.id);

describe("propis2: the paper menu (owner, 2026-11-24: «4, 5, 6, 8», not «5, 8, 6, 4»; the Russian ones too)", () => {
  it("the British and the Slovene papers by their size, smallest first; square and ruled stay at the end", () => {
    expect(ids(menuPapers(list(["en_gb", "en_gb_8", "en_gb_6", "en_gb_4", "square", "ruled"])))).toEqual(["en_gb_4", "en_gb", "en_gb_6", "en_gb_8", "square", "ruled"]);
    expect(ids(menuPapers(list(["sl_10", "sl_8", "sl_6", "sl", "square", "ruled"])))).toEqual(["sl", "sl_6", "sl_8", "sl_10", "square", "ruled"]);
    expect(menuPapers(list(["en_gb", "en_gb_8", "en_gb_6", "en_gb_4"])).map((g) => fourLinePaper(g.id).xMm)).toEqual([4, 5, 6, 8]);
  });
  it("the Russian ones too: the copybook row 4 mm, step 2 5 mm, step 1 8 mm; papers without a size in mm keep their place", () => {
    expect(ids(menuPapers(list(["propis", "m1", "m2", "square", "ruled"])))).toEqual(["propis", "m2", "m1", "square", "ruled"]);
    expect(ids(menuPapers(list(["print_cell", "print_bigcell", "print_line"])))).toEqual(["print_cell", "print_bigcell", "print_line"]);
  });
});
