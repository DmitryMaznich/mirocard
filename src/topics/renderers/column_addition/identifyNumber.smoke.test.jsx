import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by the
// current-question prompt's text sizing) needs one. No-op stub — this
// test doesn't assert on live-resize font shrinking.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("IdentifyNumberTask", () => {
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
        <IdentifyNumberTask
          task={task}
          onCorrect={handlers.onCorrect ?? (() => {})}
          onMistake={handlers.onMistake ?? (() => {})}
          onFlashIncorrect={handlers.onFlashIncorrect ?? (() => {})}
        />
      );
    });
  }

  function digitButton(d) {
    return Array.from(container.querySelectorAll(".pv-numkey")).find((b) => b.textContent === String(d));
  }

  function question() {
    return container.querySelector(".pv-question");
  }

  it("mounts without crashing, asking for tens first", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });
    expect(question().textContent).toBe("Сколько десятков?");
  });

  it("marks the coin zones to flex-fit the remaining screen height, even with a large tens/ones count", () => {
    // jsdom reports 0 for clientHeight/clientWidth (no real layout), so the
    // zoneScale computation's own early-return guard always fires here —
    // this only confirms the mechanism is wired up (the flex-fit class and
    // a --cb-scale inline style are present), not the actual fitted
    // scale value, which needs a real viewport — verified separately via
    // a static-HTML mockup across a matrix of device heights/counts.
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 99, model: { tens: 9, ones: 9 } });
    const zones = container.querySelector(".pv-zones");
    expect(zones.className).toContain("pv-zones--flex-fit");
    expect(zones.style.getPropertyValue("--cb-scale")).toBeTruthy();
    expect(container.querySelectorAll(".cb-ten-stack").length).toBe(9);
    expect(container.querySelectorAll(".cb-coin").length).toBe(9);
  });

  it("switches the question to ones after tens is answered, and keeps the tens digit shown after a wrong ones digit", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });

    act(() => { digitButton(2).click(); }); // correct tens
    expect(question().textContent).toBe("Сколько единиц?");

    act(() => { digitButton(9).click(); }); // wrong ones
    const slots = container.querySelectorAll(".pv-answer-slot");
    expect(slots[0].textContent).toBe("2"); // tens digit persists
    expect(slots[0].className).toContain("pv-answer-slot--correct");
    expect(slots[1].className).toContain("pv-answer-slot--shake");
  });

  it("shows 'Правильно!' and waits for a tap on Далее before calling onCorrect", () => {
    // The real merge animation flies two ghosts via Element.animate(),
    // which jsdom doesn't implement — this test forces the
    // prefers-reduced-motion path instead (playMergeAnimation's own
    // early branch), which sets the same end state synchronously,
    // without touching the Web Animations API or real layout
    // measurement. The flight itself is exercised visually, not here —
    // same "hard to unit-test at this level" precedent as
    // RegroupTenTask's dnd-kit drag.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    vi.useFakeTimers();

    try {
      const onCorrect = vi.fn();
      mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } }, { onCorrect });

      act(() => { digitButton(2).click(); }); // correct tens
      act(() => { digitButton(3).click(); }); // correct ones
      act(() => { vi.advanceTimersByTime(180); }); // pre-merge beat

      expect(question().textContent).toBe("Правильно!");
      expect(question().className).toContain("pv-question--correct");

      const merged = container.querySelector(".pv-merged-number");
      expect(merged.textContent).toBe("23");
      expect(merged.className).toContain("pv-merged-number--visible");

      // Reaching the merged result does not advance on its own.
      expect(onCorrect).not.toHaveBeenCalled();
      expect(container.querySelector(".pv-numpad")).toBeNull();

      const nextButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Далее"));
      expect(nextButton).toBeTruthy();
      act(() => { nextButton.click(); });
      expect(onCorrect).toHaveBeenCalledWith("x", "x");
    } finally {
      vi.useRealTimers();
      window.matchMedia = originalMatchMedia;
    }
  });
});
