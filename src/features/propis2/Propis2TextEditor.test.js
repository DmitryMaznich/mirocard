import { describe, expect, it } from "vitest";
import { rowLabel } from "./Propis2TextEditor.jsx";

// the rows of the sheet a line of the page editor takes (owner, 2026-10-18): a running text wraps over several
describe("rowLabel", () => {
  it("one row, a range, nothing for a line with no row yet", () => {
    expect(rowLabel({ from: 3, to: 3 }, 17)).toEqual({ text: "3", sheet: null, over: false });
    expect(rowLabel({ from: 1, to: 9 }, 17)).toEqual({ text: "1–9", sheet: null, over: false });
    expect(rowLabel(undefined, 17)).toBeNull();
  });
  it("past the sheet: the rows are marked, «лист N» where the next sheet begins within the line", () => {
    expect(rowLabel({ from: 12, to: 20 }, 17)).toEqual({ text: "12–20", sheet: 2, over: true });
    expect(rowLabel({ from: 18, to: 18 }, 17)).toEqual({ text: "18", sheet: 2, over: true });
    expect(rowLabel({ from: 19, to: 22 }, 17)).toEqual({ text: "19–22", sheet: null, over: true });
    expect(rowLabel({ from: 30, to: 40 }, 17)).toEqual({ text: "30–40", sheet: 3, over: true });
  });
});
