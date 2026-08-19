import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import ReadTextView from "./ReadTextView.jsx";
import { UNIT_H, TEXT_ROW_PITCH } from "./propisRuling.js";

// jsdom has no ResizeObserver -- ReadTextView (like WriteTextView.jsx, same unmodified
// pattern) uses one to size the grid to its real on-screen width. The stub never fires,
// so the view just keeps its default wrapW (320) for every test here; every text used
// below is short enough that the exact width doesn't affect word-wrap outcomes.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
// jsdom also has no Element.scrollTo -- ReadTextView calls it to reset scroll position
// when switching texts; a no-op stub is enough since this test only checks DOM content,
// not actual scroll position.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

// Minimal captured-letter fixtures, same shape wordEngine.test.js uses -- geometry
// correctness of buildWordTrajectory/layoutTextIntoRows is already covered there. This
// file only needs to confirm ReadTextView itself (new 2026-08-19) wires task.texts into
// real rendered DOM correctly: text switching, Prev/Next boundary state, the empty state,
// and that layoutTextIntoRows' output actually reaches one hit-target per word. Doesn't
// exercise the tap-to-animate interaction itself (AnimatedStrokes/useLoopingStrokes,
// unmodified, already-shipped via WriteTextView.jsx) -- jsdom has no SVGGeometryElement
// (getTotalLength/getPointAtLength), so that path isn't testable here without a stub
// fragile enough to not be worth it for code this view doesn't own.
const LETTER_A = { id: "а", type: "letter", viewBox: "0 0 100 150", strokes: [{ d: "M 10 75 C 12 74 14 74 16 75 C 18 76 20 76 22 75" }] };
const LETTER_B = { id: "б", type: "letter", viewBox: "0 0 100 150", strokes: [{ d: "M 10 37 C 12 50 14 60 16 75 C 18 78 20 78 22 75" }] };

const TASK = {
  letters: [LETTER_A, LETTER_B],
  connectors: [],
  texts: ["аб аб", "ба аб аб"],
};

describe("ReadTextView — mounted through the real component", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<ReadTextView task={task} onClose={() => {}} />);
    });
  }

  it("shows an empty-state hint when no texts are selected", () => {
    mount({ letters: [LETTER_A], connectors: [], texts: [] });
    expect(container.textContent).toContain("не выбрано ни одного текста");
    expect(container.querySelector(".propis-text-nav")).toBeFalsy();
  });

  it("shows the first text with a correct counter and Prev disabled, Next enabled", () => {
    mount(TASK);
    const counter = container.querySelector(".propis-text-nav__counter");
    expect(counter?.textContent).toBe("Текст 1 из 2");
    const [prevBtn, nextBtn] = container.querySelectorAll(".propis-text-nav .propis-ctrl-btn");
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
  });

  it("renders one word hit-target per word layoutTextIntoRows placed, for the current text only", () => {
    mount(TASK);
    // "аб аб" -> 2 words.
    expect(container.querySelectorAll(".propis-text-word-hit").length).toBe(2);
  });

  it("Next advances to the next text, updates the word count and counter, and disables itself at the end", () => {
    mount(TASK);
    const nextBtn = container.querySelectorAll(".propis-text-nav .propis-ctrl-btn")[1];
    act(() => { nextBtn.click(); });

    expect(container.querySelector(".propis-text-nav__counter")?.textContent).toBe("Текст 2 из 2");
    // "ба аб аб" -> 3 words.
    expect(container.querySelectorAll(".propis-text-word-hit").length).toBe(3);
    const [prevBtn2, nextBtn2] = container.querySelectorAll(".propis-text-nav .propis-ctrl-btn");
    expect(prevBtn2.disabled).toBe(false);
    expect(nextBtn2.disabled).toBe(true);
  });

  it("Prev returns to the first text from the second", () => {
    mount(TASK);
    const buttons = () => container.querySelectorAll(".propis-text-nav .propis-ctrl-btn");
    act(() => { buttons()[1].click(); }); // -> text 2
    act(() => { buttons()[0].click(); }); // -> back to text 1
    expect(container.querySelector(".propis-text-nav__counter")?.textContent).toBe("Текст 1 из 2");
  });

  // Regression guard for the "extra blank ruled line between every text line" bug
  // (reported 2026-08-19, fixed by tiling rows TEXT_ROW_PITCH apart instead of the full
  // UNIT_H): a multi-row text's viewBox must grow by TEXT_ROW_PITCH per extra row, not by
  // a full UNIT_H, or the wasted-space bug is back.
  it("tiles multi-row text TEXT_ROW_PITCH apart, not a full UNIT_H apart", () => {
    const longWord = Array(20).fill("аб").join(" "); // forces a wrap onto a 2nd row
    mount({ letters: [LETTER_A, LETTER_B], connectors: [], texts: [longWord] });
    const svg = container.querySelector(".propis-text-grid-svg");
    const [, , , heightStr] = svg.getAttribute("viewBox").split(" ");
    const height = Number(heightStr);
    // Must actually have wrapped for this test to mean anything.
    expect(height).toBeGreaterThan(UNIT_H);
    const rowCount = Math.round((height - UNIT_H) / TEXT_ROW_PITCH) + 1;
    expect(rowCount).toBeGreaterThanOrEqual(2);
    expect(height).toBe((rowCount - 1) * TEXT_ROW_PITCH + UNIT_H);
  });
});
