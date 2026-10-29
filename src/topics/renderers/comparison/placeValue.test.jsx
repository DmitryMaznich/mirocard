import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { generateTasks, placeValuePair, COMPARISON_LEVELS } from "./engine.js";
import { placeHintText } from "./PlaceHint.jsx";
import ComparisonRenderer from "./index.jsx";

const cards = [{ id: "compare_easy", conceptId: "compare_easy", renderer: "comparison" }];
const swapped = (a, b) => String(a).split("").sort().join() === String(b).split("").sort().join();

describe("Сравнение — уровень 5 «По разрядам»", () => {
  it("is offered as level 5", () => {
    expect(COMPARISON_LEVELS.find((l) => l.id === 5).params.placeValue).toBe(true);
  });

  it("half the pairs are traps: swapped digits, 99 / 100, 300 / 299 …; no equal pairs unless asked", () => {
    const used = new Set();
    const pairs = Array.from({ length: 400 }, () => placeValuePair(used));
    expect(pairs.every(({ left, right }) => left !== right && left >= 10 && right <= 999 && right >= 10 && left <= 999)).toBe(true);
    expect(pairs.filter(({ left, right }) => swapped(left, right)).length).toBeGreaterThan(60);
    expect(pairs.some(({ left, right }) => (left < 100) !== (right < 100))).toBe(true);
    expect(pairs.some(({ left, right }) => Math.max(left, right) % 100 === 0 && Math.abs(left - right) < 10)).toBe(true);
  });

  it("tasks carry the hint, except in «Контрольная работа»", () => {
    const evaluate = generateTasks({ id: "compare_evaluate", type: "compare_evaluate" }, cards, 10, { level: 5 });
    expect(evaluate.every((t) => t.placeHint && Math.max(t.left, t.right) <= 999)).toBe(true);
    const lvl4 = generateTasks({ id: "compare_evaluate", type: "compare_evaluate" }, cards, 10, { level: 4 });
    expect(lvl4.every((t) => !t.placeHint)).toBe(true);
  });

  it("only in «Сравни и поставь знак»; other modes fall back to level 4", () => {
    for (const id of ["compare_visual", "compare_sign", "compare_draw_sign", "compare_first_number"]) {
      const tasks = generateTasks({ id, type: id }, cards, 20, { level: 5, visualMode: "numbers" });
      expect(tasks.every((t) => t.left <= 99 && t.right <= 99 && !t.placeHint)).toBe(true);
    }
  });

  it("the hint names the deciding place, from the highest down", () => {
    expect(placeHintText(305, 350)).toBe("Сотни поровну. Десятки: 0 и 5 — больше у 350.");
    expect(placeHintText(482, 428)).toBe("Сотни поровну. Десятки: 8 и 2 — больше у 482.");
    expect(placeHintText(47, 74)).toBe("Десятки: 4 и 7 — больше у 74.");
    expect(placeHintText(99, 100)).toBe("В числе 100 есть сотни, в 99 — нет. 100 больше.");
    expect(placeHintText(300, 299)).toBe("Сотни: 3 и 2 — больше у 300.");
  });
});

describe("Сравнение — подсказка по разрядам на экране", () => {
  let root, container;
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const mount = (task, taskRetry) => {
    container = document.createElement("div"); document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<ComparisonRenderer task={task} taskRetry={taskRetry} onCorrect={() => {}} onIncorrect={() => {}} onAdvance={() => {}} />));
  };
  const task = { type: "compare_evaluate", left: 305, right: 350, conceptId: "c", question: "less", style: "sign", placeHint: true };

  it("not on the first try", () => {
    mount(task, 0);
    expect(container.querySelector(".cmp-place-hint")).toBeNull();
  });

  it("on the second try: both numbers by places, the tens marked", () => {
    mount(task, 1);
    expect(container.querySelector(".cmp-place-say").textContent).toBe("Сотни поровну. Десятки: 0 и 5 — больше у 350.");
    expect([...container.querySelectorAll(".cmp-place--decide")].map((e) => e.textContent)).toEqual(["Десятки", "0", "5"]);
  });
});
