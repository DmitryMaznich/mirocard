import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import RegroupTenTask from "./RegroupTenTask.jsx";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by the
// instruction line's text sizing) needs one. No-op stub.
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

  it("mounts showing the instruction as a single non-interactive line", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { cardId: "x", conceptId: "x", type: "regroup_ten", number: 23, initial: { tens: 2, ones: 3 }, after: { tens: 1, ones: 13 } };
    act(() => {
      root.render(<RegroupTenTask task={task} onCorrect={() => {}} />);
    });
    const question = container.querySelector(".pv-question");
    expect(question.textContent).toBe("Разменяй десяток в единицы");
    expect(question.getAttribute("role")).toBeNull();
  });
});
