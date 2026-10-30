import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { generateTasks, getVerdict } from "./engine.js";
import ComparisonRenderer from "./index.jsx";

const cards = [{ id: "compare_medium", conceptId: "compare_medium" }];
const MODE_SIGN = { id: "compare_sign", type: "compare_sign", defaultCardId: "compare_medium", ui: { instruction: "Нажми на большее число" } };

let container, root, calls;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

function render(task) {
  calls = { right: 0, wrong: 0 };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<ComparisonRenderer task={{ type: "compare_sign", conceptId: "compare_medium", ...task }} mode={MODE_SIGN} sessionStatus="task_active"
    onCorrect={() => calls.right++} onIncorrect={() => calls.wrong++} />));
}
const text = () => container.textContent;
const sides = () => container.querySelectorAll(".compare-side");
const equalButton = () => container.querySelector(".croc-tap-btn");

describe("Сравнение — «Вводим знак — Крокодил»", () => {
  it("equal pairs are asked the same way as the others", () => {
    for (const question of ["more", "less", "mix"]) {
      const tasks = generateTasks(MODE_SIGN, cards, 60, { question, showEqual: true, level: 2 });
      const equal = tasks.filter((t) => t.left === t.right);
      expect(equal.length).toBeGreaterThan(0);
      equal.forEach((t) => expect(t.ask).toBe(question === "less" ? "less" : "more"));
    }
  });

  it("the phrase reads the record left to right", () => {
    expect(getVerdict({ type: "compare_sign", left: 3, right: 7, question: "more" })).toBe("3 меньше 7");
    expect(getVerdict({ type: "compare_sign", left: 7, right: 3, question: "less" })).toBe("7 больше 3");
    expect(getVerdict({ type: "compare_sign", left: 3, right: 7, question: "more", wordsVerdict: true })).toBe("Три меньше семи");
  });

  it("a correct tap opens the crocodile and reads the record", () => {
    render({ left: 3, right: 7, question: "more", ask: "more", showEqual: false });
    expect(text()).toContain("пасть к большему");
    act(() => sides()[1].click());
    expect(calls).toEqual({ right: 1, wrong: 0 });
    expect(container.querySelector(".compare-croc-sign")).toBeNull();
    expect(text()).toContain("3 меньше 7");
  });

  it("asking for the smaller one, the tip speaks of the sharp corner", () => {
    render({ left: 8, right: 2, question: "less", ask: "less", showEqual: false });
    expect(text()).toContain("Нажми на меньшее число");
    expect(text()).toContain("уголок показывает на меньшее");
    act(() => sides()[1].click());
    expect(text()).toContain("8 больше 2");
  });

  it("with = on, the crocodile answers «поровну» on every pair and the wording gives nothing away", () => {
    render({ left: 4, right: 4, question: "equal", ask: "more", showEqual: true });
    expect(text()).toContain("Нажми на большее число");
    act(() => equalButton().click());
    expect(calls).toEqual({ right: 1, wrong: 0 });
    expect(text()).toContain("4 = 4");
    act(() => root.unmount()); container.remove();

    render({ left: 4, right: 6, question: "more", ask: "more", showEqual: true });
    expect(text()).toContain("Нажми на большее число");
    act(() => equalButton().click());
    expect(calls).toEqual({ right: 0, wrong: 1 });
  });

  it("a number tapped on an equal pair is a mistake", () => {
    render({ left: 5, right: 5, question: "equal", ask: "more", showEqual: true });
    act(() => sides()[0].click());
    expect(calls).toEqual({ right: 0, wrong: 1 });
  });
});
