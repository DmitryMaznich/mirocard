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
    expect(question.textContent).toBe("Перетащи десяток к единицам");
    expect(question.getAttribute("role")).toBeNull();
  });

  // The last ten-stack is the only interactive thing on this screen — it
  // needs some visual difference from the static stacks beside it, or the
  // whole screen reads as dead (see the halo+bob hint in coins.css).
  it("marks exactly the last ten-stack as the draggable one, with a hint and a direction arrow", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { cardId: "x", conceptId: "x", type: "regroup_ten", number: 23, initial: { tens: 2, ones: 3 }, after: { tens: 1, ones: 13 } };
    act(() => {
      root.render(<RegroupTenTask task={task} onCorrect={() => {}} />);
    });

    const draggable = container.querySelectorAll(".pv-ten-stack--draggable");
    expect(draggable.length).toBe(1);
    expect(draggable[0].className).toContain("pv-ten-stack--hint");
    expect(container.querySelectorAll(".cb-ten-stack").length).toBe(2); // both stacks still render normally
    expect(container.querySelector(".pv-regroup-arrow")).toBeTruthy();
  });
});
