import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { hintDirectionFor } from "./placeValueLabels.js";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by every
// checklist row's text sizing) needs one. A no-op stub is enough — this
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

  it("mounts without crashing", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 23, target: { tens: 2, ones: 3 } };
    act(() => {
      root.render(<BuildNumberTask task={task} onCorrect={() => {}} onMistake={() => {}} onFlashIncorrect={() => {}} />);
    });
    expect(container.querySelector(".pv-checklist-item")).toBeTruthy();
  });

  it("applies pv-checklist--focused from the start, so a done row recedes immediately", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 23, target: { tens: 2, ones: 3 } };
    act(() => {
      root.render(<BuildNumberTask task={task} onCorrect={() => {}} onMistake={() => {}} onFlashIncorrect={() => {}} />);
    });
    // Even in "collect" (before any row is done yet), the recede rule must
    // already be in effect — it used to only turn on once the answer step
    // began, which left every earlier "done" row (e.g. after confirming
    // collect) showing just green+strikethrough with no shrink/fade.
    expect(container.querySelector(".pv-checklist").className).toContain("pv-checklist--focused");
  });

  it("gives every visible checklist row the same font size", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    // number: 0 lets confirming "collect" succeed with zero coins placed,
    // reaching "group" (and its second checklist row) without needing to
    // simulate a dnd-kit drag.
    const task = { cardId: "x", conceptId: "x", type: "build_number", number: 0, target: { tens: 0, ones: 0 } };
    act(() => {
      root.render(<BuildNumberTask task={task} onCorrect={() => {}} onMistake={() => {}} onFlashIncorrect={() => {}} />);
    });
    act(() => {
      container.querySelector(".pv-checklist-item").click();
    });
    const rows = container.querySelectorAll(".pv-checklist-text");
    expect(rows.length).toBe(2);
    const sizes = Array.from(rows).map((el) => el.style.fontSize);
    expect(sizes[0]).toBe(sizes[1]);
  });
});
