import { describe, expect, it } from "vitest";
import { MIN_FIGURES_FOR_REWARD, hasMinimumFigureSelection, requiredFigureSelectionCount } from "./figureSelection";

describe("figure selection for rewarded drawing sessions", () => {
  it("requires five selected figures when the pool has five or more", () => {
    expect(MIN_FIGURES_FOR_REWARD).toBe(5);
    expect(requiredFigureSelectionCount(23)).toBe(5);
    expect(hasMinimumFigureSelection(4, 23)).toBe(false);
    expect(hasMinimumFigureSelection(5, 23)).toBe(true);
  });

  it("keeps a smaller deck usable by allowing its whole pool", () => {
    expect(requiredFigureSelectionCount(3)).toBe(3);
    expect(hasMinimumFigureSelection(2, 3)).toBe(false);
    expect(hasMinimumFigureSelection(3, 3)).toBe(true);
  });
});
