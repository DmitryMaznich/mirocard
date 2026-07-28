import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { hintDirectionFor } from "./placeValueLabels.js";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by the
// instruction line's text sizing) needs one. A no-op stub is enough — this
// test doesn't assert on live-resize font shrinking.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("hintDirectionFor", () => {
  it("returns 'more' when the guess is below the target", () => {
    expect(hintDirectionFor(1, 3)).toBe("more");
  });

  it("returns 'less' when the guess is above the target", () => {
    expect(hintDirectionFor(5, 3)).toBe("less");
  });
});

describe("BuildNumberTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, handlers = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <BuildNumberTask
          task={task}
          onCorrect={handlers.onCorrect ?? (() => {})}
          onMistake={handlers.onMistake ?? (() => {})}
          onFlashIncorrect={handlers.onFlashIncorrect ?? (() => {})}
        />
      );
    });
  }

  function question() {
    return container.querySelector(".pv-question");
  }

  it("mounts showing the collect instruction as a single tappable line", () => {
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 23, target: { tens: 2, ones: 3 } };
    mount(task);
    expect(question().textContent).toBe("Собери 23 монеты");
    expect(question().getAttribute("role")).toBe("button");
  });

  it("advances collect -> group -> answerTens by tapping the instruction line each time", () => {
    // number: 0 lets confirming "collect" succeed with zero coins placed,
    // and confirming "group" succeed with zero grouping needed, reaching
    // answerTens without simulating a dnd-kit drag.
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 0, target: { tens: 0, ones: 0 } };
    mount(task);

    expect(question().textContent).toBe("Собери 0 монет");
    act(() => { question().click(); });
    expect(question().textContent).toBe("Сложи десятки");
    act(() => { question().click(); });
    expect(question().textContent).toBe("Сколько десятков?");
    // The numpad ticks off answerTens/answerOnes, not a tap on the line —
    // no role="button" once we're past the tappable collect/group steps.
    expect(question().getAttribute("role")).toBeNull();
  });

  it("shakes the instruction line on a wrong collect tap, without advancing or calling onMistake more than once", () => {
    let onMistakeCalls = 0;
    const onMistake = () => { onMistakeCalls += 1; };
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 5, target: { tens: 0, ones: 5 } };
    mount(task, { onMistake });

    // No coins placed yet, so the collected total (0) doesn't match the
    // target (5) — tapping the instruction line should shake, not advance.
    act(() => { question().click(); });
    expect(question().className).toContain("pv-question--shake");
    expect(question().textContent).toBe("Собери 5 монет");
    expect(onMistakeCalls).toBe(1);
  });
});
