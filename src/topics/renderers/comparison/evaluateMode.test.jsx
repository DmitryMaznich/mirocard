import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ComparisonRenderer from "./index.jsx";

const MODE = { id: "compare_evaluate", type: "compare_evaluate", ui: { instruction: "Поставь знак" } };

let container, root, calls;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

function render(task, taskRetry = 0) {
  calls = { right: 0, wrong: 0 };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<ComparisonRenderer task={{ type: "compare_evaluate", conceptId: "compare_hard", question: "less", style: "sign", ...task }} mode={MODE}
    sessionStatus="task_active" taskRetry={taskRetry} onCorrect={() => calls.right++} onIncorrect={() => calls.wrong++} />));
}
const press = (label) => act(() => [...container.querySelectorAll("button")].find((b) => b.textContent.includes(label)).click());
const blank = () => container.querySelector(".croc-put-sign-blank").textContent;

describe("Сравнение — «Сравни и поставь знак»", () => {
  it("a wrong answer doesn't reveal the right sign", () => {
    render({ left: 3, right: 7 });
    press(">");
    expect(calls).toEqual({ right: 0, wrong: 1 });
    expect(blank()).toBe("?");
    expect(container.querySelector(".croc-put-sign-btn--correct")).toBeNull();
  });

  it("a right answer puts the sign in and reads it", () => {
    render({ left: 3, right: 7 });
    press("<");
    expect(blank()).toBe("<");
    expect(container.textContent).toContain("3 меньше 7");
  });

  it("the crocodile comes back as a reminder only after a mistake", () => {
    render({ left: 3, right: 7 });
    expect(container.querySelector(".compare-croc-tip")).toBeNull();
    act(() => root.unmount()); container.remove();
    render({ left: 3, right: 7 }, 1);
    expect(container.textContent).toContain("пасть к большему");
  });

  it("level 5 keeps its own place-value hint instead of the crocodile", () => {
    render({ left: 305, right: 350, placeHint: true }, 1);
    expect(container.querySelector(".compare-croc-tip")).toBeNull();
    expect(container.querySelector(".cmp-place-hint")).not.toBeNull();
  });

  it("word buttons shake on a mistake", () => {
    render({ left: 3, right: 7, style: "verbal" });
    press("Больше");
    expect(container.querySelector(".cfn-btn--wrong")).not.toBeNull();
    expect(container.querySelector(".cfn-btn--correct")).toBeNull();
  });
});
