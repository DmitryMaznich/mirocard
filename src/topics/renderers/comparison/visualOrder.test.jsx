import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { generateTasks, VISUAL_MODES, visualModeLevel } from "./engine.js";
import { computeDefaultParams } from "@/features/session/computeDefaultParams";
import ComparisonRenderer from "./index.jsx";

const cards = [{ id: "compare_easy", conceptId: "compare_easy" }];
const MODE_VISUAL = { id: "compare_visual", type: "compare_visual", defaultCardId: "compare_easy", ui: { instruction: "Нажми" } };
const maxNumber = (tasks) => Math.max(...tasks.flatMap((t) => [t.left, t.right]));

describe("Сравнение — «Сравни и нажми»: порядок вариантов", () => {
  it("offers pairs first, then dots, dots with a number, numbers alone", () => {
    expect(VISUAL_MODES.map((v) => v.value)).toEqual(["pairing", "dots", "dots_numbers", "numbers"]);
  });

  it("plain dots only on level 1, pairs up to 10, dots with a number up to 20", () => {
    expect(visualModeLevel("dots", 2)).toBe(1);
    expect(visualModeLevel("pairing", 4)).toBe(2);
    expect(visualModeLevel("dots_numbers", 4)).toBe(3);
    expect(visualModeLevel("numbers", 4)).toBe(4);
  });

  it("a level saved from another view is held to the view's range", () => {
    const dots = generateTasks(MODE_VISUAL, cards, 40, { visualMode: "dots", level: 4 });
    expect(dots.every((t) => Math.abs(t.left - t.right) >= 5 && t.left <= 10 && t.right <= 10)).toBe(true);
    expect(maxNumber(generateTasks(MODE_VISUAL, cards, 60, { visualMode: "pairing", level: 4 }))).toBeLessThanOrEqual(10);
    expect(maxNumber(generateTasks(MODE_VISUAL, cards, 60, { visualMode: "dots_numbers", level: 4 }))).toBeLessThanOrEqual(20);
  });

  it("a lesson starts with pairs on level 1, «поровну» on", () => {
    expect(computeDefaultParams({ meta: { renderer: "comparison" } }, MODE_VISUAL))
      .toMatchObject({ visualMode: "pairing", level: 1, showEqual: true });
    expect(computeDefaultParams({ meta: { renderer: "comparison" } }, { id: "compare_sign" }))
      .toMatchObject({ visualMode: "dots", level: 2, showEqual: false });
  });
});

describe("Сравнение — «Сравни и нажми»: тап по стороне на равенстве", () => {
  let container, root;
  afterEach(() => { act(() => root?.unmount()); container?.remove(); });

  it("counts as a mistake instead of doing nothing", () => {
    const task = { type: "compare_visual", left: 4, right: 4, question: "equal", showEqual: true, visualMode: "dots", conceptId: "compare_easy", instruction: "Где больше точек?" };
    let wrong = 0, right = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ComparisonRenderer task={task} mode={MODE_VISUAL} sessionStatus="task_active" onCorrect={() => right++} onIncorrect={() => wrong++} />));
    act(() => container.querySelector(".compare-side").click());
    expect(wrong).toBe(1);
    expect(right).toBe(0);
  });
});
