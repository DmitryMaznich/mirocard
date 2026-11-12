import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdditionSubtractionRenderer from "./index.jsx";

const task = {
  type: "operation_chain",
  cardId: "operation_plus",
  conceptId: "plus",
  steps: 3,
  terms: [5, 2, 1, 3],
  ops: ["add", "subtract", "add"],
  partials: [7, 6, 9],
  result: 9,
  maxNumber: 10,
  resultOptions: [7, 8, 9, 10],
  inputMode: "pad",
  stepHint: true,
};

describe("operation_chain", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    vi.useRealTimers();
    root = null;
    container = null;
  });

  function mount(t, callbacks = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<AdditionSubtractionRenderer task={t} onCorrect={callbacks.onCorrect ?? (() => {})} onIncorrect={callbacks.onIncorrect ?? (() => {})} onMistake={() => {}} />);
    });
  }
  const click = (el) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  const key = (d) => [...container.querySelectorAll(".operation-audio-keypad__grid .operation-audio-key")].find((b) => b.textContent === String(d));
  const type = (value) => { String(value).split("").forEach((d) => click(key(d))); click(container.querySelector('[aria-label="Проверить"]')); };

  it("shows all actions with a red minus and says «Считай по порядку»", () => {
    mount(task);
    expect(container.querySelector(".chain-expression").textContent).toBe("5+2−1+3=?");
    expect(container.querySelector(".chain-expression__sign--subtract").textContent).toBe("−");
    expect(container.querySelector(".chain-caption").textContent).toBe("Считай по порядку");
  });

  it("solved directly: an ordinary correct answer", () => {
    const onCorrect = vi.fn();
    mount(task, { onCorrect });
    type(9);
    expect(onCorrect).toHaveBeenCalledWith("plus", "operation_plus");
  });

  it("«По шагам»: the child solves each action, a wrong step is retried, the task ends assisted (no star)", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();
    const onIncorrect = vi.fn();
    mount(task, { onCorrect, onIncorrect });
    click(container.querySelector(".chain-hint-btn"));

    expect(container.querySelector(".chain-step--current .chain-step__expr").textContent).toBe("5+2=?");
    type(8);
    expect(container.querySelector(".chain-step__answer--wrong").textContent).toBe("8");
    act(() => { vi.advanceTimersByTime(800); });
    expect(onIncorrect).not.toHaveBeenCalled();
    type(7);
    expect(container.querySelector(".chain-step--current .chain-step__expr").textContent).toBe("7−1=?");
    type(6);
    expect(container.querySelector(".chain-step--current .chain-step__expr").textContent).toBe("6+3=?");
    type(9);
    expect(container.querySelector(".chain-expression").textContent).toBe("5+2−1+3=9");
    expect(onCorrect).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onCorrect).toHaveBeenCalledWith("plus", "operation_plus", { assisted: true });
    expect(onIncorrect).not.toHaveBeenCalled();
  });

  it("still shows an old two-action task (A/B/C only)", () => {
    mount({ type: "operation_chain", cardId: "c", conceptId: "c", A: 4, B: 2, opAB: "add", signAB: "+", C: 1, opBC: "subtract", signBC: "-", result: 5, maxNumber: 10, resultOptions: [4, 5, 6, 7] });
    expect(container.querySelector(".chain-expression").textContent).toBe("4+2−1=?");
  });
});
