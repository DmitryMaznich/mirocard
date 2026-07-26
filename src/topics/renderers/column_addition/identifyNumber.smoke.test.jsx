import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
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

  it("keeps the tens row marked done after a wrong ones digit", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });

    act(() => { digitButton(2).click(); }); // correct tens
    expect(container.querySelectorAll(".pv-checklist-item").length).toBe(2);

    act(() => { digitButton(9).click(); }); // wrong ones
    const items = container.querySelectorAll(".pv-checklist-item");
    expect(items[0].className).toContain("is-done");
    expect(items[1].className).toContain("is-wrong");
  });
});
