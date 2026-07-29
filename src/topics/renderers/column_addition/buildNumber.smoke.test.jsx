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

  function trayButton(label) {
    return container.querySelector(`.pv-tray-mat button[aria-label="${label}"]`);
  }

  it("mounts showing the collect instruction (not tappable) plus icon-only Сначала/Сделано buttons flanking the pile", () => {
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 23, target: { tens: 2, ones: 3 } };
    mount(task);
    expect(question().textContent).toBe("Перенеси 23 монеты");
    expect(question().getAttribute("role")).toBeNull();
    expect(trayButton("Сначала")).toBeTruthy();
    expect(trayButton("Сделано")).toBeTruthy();
  });

  it("advances collect -> group -> answerTens: Сделано confirms collect, tapping the question confirms group", () => {
    // number: 0 lets confirming "collect" succeed with zero coins placed,
    // and confirming "group" succeed with zero grouping needed, reaching
    // answerTens without simulating a dnd-kit drag.
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 0, target: { tens: 0, ones: 0 } };
    mount(task);

    expect(question().textContent).toBe("Перенеси 0 монет");
    act(() => { trayButton("Сделано").click(); });
    expect(question().textContent).toBe("Собери десятки");
    // group has no pile to hang a button off, so it still confirms via a
    // tap on the question itself.
    expect(question().getAttribute("role")).toBe("button");
    act(() => { question().click(); });
    expect(question().textContent).toBe("Сколько десятков?");
    expect(question().getAttribute("role")).toBeNull();
  });

  it("shakes the Сделано button on a wrong collect tap, without advancing or calling onMistake more than once", () => {
    let onMistakeCalls = 0;
    const onMistake = () => { onMistakeCalls += 1; };
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 5, target: { tens: 0, ones: 5 } };
    mount(task, { onMistake });

    // No coins placed yet, so the collected total (0) doesn't match the
    // target (5) — tapping "Сделано" should shake it, not advance.
    act(() => { trayButton("Сделано").click(); });
    expect(trayButton("Сделано").closest(".pv-tray-done--shake")).toBeTruthy();
    expect(question().textContent).toBe("Перенеси 5 монет");
    expect(onMistakeCalls).toBe(1);
  });

  it("Сначала stays on the collect phase without crashing", () => {
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 5, target: { tens: 0, ones: 5 } };
    mount(task);

    act(() => { trayButton("Сначала").click(); });
    expect(question().textContent).toBe("Перенеси 5 монет");
  });
});
