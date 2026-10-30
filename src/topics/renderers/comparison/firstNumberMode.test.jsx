import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { numberInWords, getVerdict } from "./engine.js";
import ComparisonRenderer from "./index.jsx";

const MODE = { id: "compare_first_number", type: "compare_first_number", ui: { instruction: "Сравни" } };

let container, root, calls;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

function render(left, right, taskRetry = 0) {
  calls = { right: 0, wrong: 0 };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const question = left === right ? "equal" : left < right ? "less" : "more";
  act(() => root.render(<ComparisonRenderer task={{ type: "compare_first_number", conceptId: "compare_medium", left, right, question, showLabels: true }} mode={MODE}
    sessionStatus="task_active" taskRetry={taskRetry} onCorrect={() => calls.right++} onIncorrect={() => calls.wrong++} onAdvance={() => {}} />));
}
const press = (label) => act(() => [...container.querySelectorAll("button")].find((b) => b.textContent.includes(label)).click());

describe("Сравнение — «Сравни первое и второе»", () => {
  it("a wrong answer reveals neither the sign nor the phrase", () => {
    render(3, 7);
    press("Больше");
    expect(calls).toEqual({ right: 0, wrong: 1 });
    expect(container.querySelector(".cfn-bridge").textContent).toBe("?");
    expect(container.textContent).not.toContain("Три меньше семи");
    expect(container.querySelector(".cfn-btn--wrong")).not.toBeNull();
  });

  it("a right answer shows the sign and the phrase", () => {
    render(3, 7);
    press("Меньше");
    expect(container.querySelector(".cfn-bridge").textContent).toBe("<");
    expect(container.textContent).toContain("Три меньше семи");
  });

  it("equal pairs read like the other modes: «Четыре равно четырём»", () => {
    render(4, 4);
    press("Равно");
    expect(container.textContent).toContain("Четыре равно четырём");
  });

  it("after a mistake the crocodile reminder shows", () => {
    render(3, 7, 1);
    expect(container.textContent).toContain("пасть к большему");
  });
});

describe("numberInWords", () => {
  it("names numbers up to 999 in the three cases", () => {
    expect(numberInWords(47)).toBe("сорок семь");
    expect(numberInWords(47, "gen")).toBe("сорока семи");
    expect(numberInWords(99, "dat")).toBe("девяноста девяти");
    expect(numberInWords(305)).toBe("триста пять");
    expect(numberInWords(350, "gen")).toBe("трёхсот пятидесяти");
    expect(numberInWords(200, "dat")).toBe("двумстам");
    expect(numberInWords(112, "gen")).toBe("ста двенадцати");
  });

  it("phrases in words no longer switch to digits above 20", () => {
    expect(getVerdict({ type: "compare_evaluate", showLabels: true, left: 47, right: 74, wordsVerdict: true })).toBe("Сорок семь меньше семидесяти четырёх");
    expect(getVerdict({ type: "compare_sign", left: 305, right: 305, wordsVerdict: true })).toBe("Триста пять равно трёмстам пяти");
  });
});
