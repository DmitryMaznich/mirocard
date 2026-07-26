import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import RegroupTenTask from "./RegroupTenTask.jsx";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by the
// checklist row's text sizing) needs one. No-op stub.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("RegroupTenTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  it("mounts without crashing, showing one pending checklist row", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { cardId: "x", conceptId: "x", type: "regroup_ten", number: 23, initial: { tens: 2, ones: 3 }, after: { tens: 1, ones: 13 } };
    act(() => {
      root.render(<RegroupTenTask task={task} onCorrect={() => {}} />);
    });
    const items = container.querySelectorAll(".pv-checklist-item");
    expect(items.length).toBe(1);
    expect(items[0].className).toContain("is-pending");
  });
});
