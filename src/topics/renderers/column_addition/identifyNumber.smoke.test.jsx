import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by both
// checklist rows' text sizing) needs one. No-op stub — this test doesn't
// assert on live-resize font shrinking.
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

  it("mounts without crashing, showing only the tens question first", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });
    expect(container.querySelectorAll(".pv-checklist-item").length).toBe(1);
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

  it("keeps the tens row marked done after a wrong ones digit", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });

    act(() => { digitButton(2).click(); }); // correct tens
    expect(container.querySelectorAll(".pv-checklist-item").length).toBe(2);

    act(() => { digitButton(9).click(); }); // wrong ones
    const items = container.querySelectorAll(".pv-checklist-item");
    expect(items[0].className).toContain("is-done");
    expect(items[1].className).toContain("is-wrong");
  });

  it("merges the two confirmed digits into one number and calls onCorrect", () => {
    // The real merge animation flies two ghosts via Element.animate(),
    // which jsdom doesn't implement — this test forces the
    // prefers-reduced-motion path instead (playMergeAnimation's own
    // early branch), which sets the same end state synchronously on a
    // timer, without touching the Web Animations API or real layout
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
      act(() => { vi.advanceTimersByTime(500); }); // reduced-motion hold before onCorrect

      const merged = container.querySelector(".pv-merged-number");
      expect(merged.textContent).toBe("23");
      expect(merged.className).toContain("pv-merged-number--visible");
      expect(onCorrect).toHaveBeenCalledWith("x", "x");
    } finally {
      vi.useRealTimers();
      window.matchMedia = originalMatchMedia;
    }
  });
});
