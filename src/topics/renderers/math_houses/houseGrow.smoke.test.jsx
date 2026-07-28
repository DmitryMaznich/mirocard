import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import MathHousesRenderer from "./index.jsx";

describe("HouseGrow (math_houses_grow)", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.useRealTimers();
  });

  function mount(task, handlers = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <MathHousesRenderer
          task={task}
          onCorrect={handlers.onCorrect ?? (() => {})}
          onMistake={handlers.onMistake ?? (() => {})}
        />
      );
    });
  }

  function rerender(task, handlers = {}) {
    act(() => {
      root.render(
        <MathHousesRenderer
          task={task}
          onCorrect={handlers.onCorrect ?? (() => {})}
          onMistake={handlers.onMistake ?? (() => {})}
        />
      );
    });
  }

  function optionButtons() {
    return Array.from(container.querySelectorAll(".math-house-num-btn"));
  }

  function clickOption(value) {
    const btn = optionButtons().find((b) => b.textContent === String(value));
    act(() => { btn.click(); });
  }

  const HOUSE_2 = {
    type: "math_houses_grow", cardId: "house_2", conceptId: "house_2",
    number: 2, total: 2, pairs: [[0, 2], [1, 1], [2, 0]],
  };
  const HOUSE_3 = {
    type: "math_houses_grow", cardId: "house_3", conceptId: "house_3",
    number: 3, total: 3, pairs: [[0, 3], [1, 2], [2, 1], [3, 0]],
  };

  it("shows a caption naming the current house's number", () => {
    mount(HOUSE_2, { onCorrect: () => {} });
    expect(container.querySelector(".math-house-grow-caption").textContent).toBe("Собери домик числа 2");
  });

  it("resets to an interactive, empty house after moving to the next card", () => {
    vi.useFakeTimers();
    mount(HOUSE_2, { onCorrect: () => {} });

    // Complete house_2: (0,2), (1,1), (2,0)
    clickOption(0); clickOption(2);
    clickOption(1); clickOption(1);
    clickOption(2); clickOption(0);

    expect(container.querySelector(".math-house-roof-badge--done")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(700); });

    const onCorrect2 = vi.fn();
    rerender(HOUSE_3, { onCorrect: onCorrect2 });

    // Bug: stale `done` state hides the option pad and the completed-pairs
    // list still shows house_2's leftover rows instead of a fresh house_3.
    expect(optionButtons().length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".math-house-floor--grow-enter").length).toBe(0);

    // And it must not auto-complete house_3 without any user interaction.
    act(() => { vi.advanceTimersByTime(700); });
    expect(onCorrect2).not.toHaveBeenCalled();
  });
});
