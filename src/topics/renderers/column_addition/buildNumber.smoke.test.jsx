import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import BuildNumberTask, { hintDirectionFor } from "./BuildNumberTask.jsx";

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
});
