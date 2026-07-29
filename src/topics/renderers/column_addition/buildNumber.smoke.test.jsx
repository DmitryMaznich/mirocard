import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { hintDirectionFor, placeValueSentence } from "./placeValueLabels.js";

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

  // "Сделано" is mounted in exactly one place at a time — next to the
  // pile during collect, in .pv-footer during group — so a single
  // container-wide lookup covers both phases.
  function doneButton() {
    return container.querySelector('button[aria-label="Сделано"]');
  }

  function trayButton(label) {
    return container.querySelector(`.pv-tray-mat button[aria-label="${label}"]`);
  }

  function numpadDigit(d) {
    return Array.from(container.querySelectorAll(".pv-numkey")).find((b) => b.textContent === String(d));
  }

  it("mounts showing the collect instruction (not tappable) plus icon-only Сначала/Сделано buttons flanking the pile", () => {
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 23, target: { tens: 2, ones: 3 } };
    mount(task);
    expect(question().textContent).toBe("Перенеси 23 монеты");
    expect(question().getAttribute("role")).toBeNull();
    expect(trayButton("Сначала")).toBeTruthy();
    expect(trayButton("Сделано")).toBeTruthy();
  });

  it("advances collect -> group -> answerTens, confirming each step with its own Сделано button", () => {
    // number: 0 lets confirming "collect" succeed with zero coins placed,
    // and confirming "group" succeed with zero grouping needed, reaching
    // answerTens without simulating a dnd-kit drag.
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 0, target: { tens: 0, ones: 0 } };
    mount(task);

    expect(question().textContent).toBe("Перенеси 0 монет");
    act(() => { doneButton().click(); });
    expect(question().textContent).toBe("Собери десятки");
    // group has no pile to flank — Сделано moves into .pv-footer instead —
    // but the question itself is plain text now, not tappable, same as
    // collect.
    expect(question().getAttribute("role")).toBeNull();
    expect(doneButton().closest(".pv-footer")).toBeTruthy();
    act(() => { doneButton().click(); });
    expect(question().textContent).toBe("Сколько десятков?");
    expect(container.querySelector('button[aria-label="Сделано"]')).toBeNull();
  });

  it("shakes the Сделано button on a wrong collect tap, without advancing or calling onMistake more than once", () => {
    let onMistakeCalls = 0;
    const onMistake = () => { onMistakeCalls += 1; };
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 5, target: { tens: 0, ones: 5 } };
    mount(task, { onMistake });

    // No coins placed yet, so the collected total (0) doesn't match the
    // target (5) — tapping "Сделано" should shake it, not advance.
    act(() => { doneButton().click(); });
    expect(doneButton().closest(".pv-confirm-btn--shake")).toBeTruthy();
    expect(question().textContent).toBe("Перенеси 5 монет");
    expect(onMistakeCalls).toBe(1);
  });

  it("shows the recap sentence and waits for a tap on Далее before calling onCorrect", () => {
    // number: 0 lets collect/group confirm trivially (see above); answerTens
    // and answerOnes are then driven by the shared numpad.
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 0, target: { tens: 0, ones: 0 } };
    const onCorrect = () => { onCorrectCalls += 1; };
    let onCorrectCalls = 0;
    mount(task, { onCorrect });

    act(() => { doneButton().click(); }); // collect
    act(() => { doneButton().click(); }); // group
    act(() => { numpadDigit(0).click(); }); // answerTens
    act(() => { numpadDigit(0).click(); }); // answerOnes

    expect(question().textContent).toBe("Правильно!");
    expect(container.querySelector(".pv-recap").textContent).toBe(placeValueSentence(0, 0, 0));
    expect(onCorrectCalls).toBe(0);

    const nextButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Далее"));
    expect(nextButton).toBeTruthy();
    act(() => { nextButton.click(); });
    expect(onCorrectCalls).toBe(1);
  });

  it("Сначала stays on the collect phase without crashing", () => {
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 5, target: { tens: 0, ones: 5 } };
    mount(task);

    act(() => { trayButton("Сначала").click(); });
    expect(question().textContent).toBe("Перенеси 5 монет");
  });
});
