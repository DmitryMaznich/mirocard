import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import ColumnAdditionRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";

// No account/backend infrastructure needed — mounts the real renderer
// directly, same low-level pattern as animatedHand.smoke.test.jsx.

// jsdom has no matchMedia; useTapButtonSize (shared tap-keyboard sizing hook) needs one.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

const CARDS = [
  { id: "col_sub", conceptId: "col_sub", renderer: "column_addition", params: { operation: "subtract" } },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("ColumnArithmeticTask — compareMode", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, compareMode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ColumnAdditionRenderer
          task={task}
          mode={{ type: "column_arithmetic" }}
          sessionParams={{ compareMode }}
          onCorrect={() => {}}
          onMistake={() => {}}
        />
      );
    });
  }

  function tapDigit(d) {
    const btn = Array.from(container.querySelectorAll(".col-tap-btn"))
      .filter((b) => !b.className.includes("col-tap-btn--sign") && !b.className.includes("col-tap-btn--line"))
      .find((b) => b.textContent.trim() === String(d));
    expect(btn, `digit button "${d}" not found`).toBeTruthy();
    act(() => btn.click());
  }

  function tapSign() {
    const btn = container.querySelector(".col-tap-btn--sign");
    expect(btn, "sign button not found").toBeTruthy();
    act(() => btn.click());
  }

  function tapLine() {
    const btn = container.querySelector(".col-tap-btn--line");
    expect(btn, "line button not found").toBeTruthy();
    act(() => btn.click());
  }

  function tapCompareSign(sign) {
    const btn = Array.from(container.querySelectorAll(".col-compare-panel-btn"))
      .find((b) => b.textContent.trim() === sign);
    expect(btn, `compare-panel button "${sign}" not found`).toBeTruthy();
    act(() => btn.click());
  }

  async function fillForm(task) {
    for (const d of String(task.top).split("")) tapDigit(d);
    tapSign();
    for (const d of String(task.bottom).split("")) tapDigit(d);
    tapLine();
    // form -> solve phase transition is on a 500ms setTimeout (index.jsx).
    await act(async () => { await wait(600); });
  }

  it("always: shows the compare strip before a no-borrow column's result step, and resolves straight to normal result entry", async () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 1, { operation: "subtract", carryMode: "none", digits: 2 });
    const task = tasks[0];
    const unitsCol = task.columns[0];
    expect(unitsCol.borrowOut).toBe(0); // sanity: this column needs no borrow

    mount(task, "always");
    await fillForm(task);

    expect(container.querySelector(".col-compare-panel")).toBeTruthy();
    // No borrow/crossout/adjust cell exists for this column — the strip is the new "always" branch.
    expect(container.querySelector('[data-cell-key="borrow:units"]')).toBeFalsy();

    const correctSign = unitsCol.compareTopDigit > unitsCol.bottomDigit ? ">" : "=";
    tapCompareSign(correctSign);

    expect(container.querySelector(".col-compare-panel")).toBeFalsy();

    tapDigit(unitsCol.writeDigit);
    const resultCell = container.querySelector('[data-cell-key="result:units"]');
    expect(resultCell.classList.contains("col-result-cell--filled")).toBe(true);
  });

  it("aux borrow boxes stay hidden until their own step is reached and its compare is resolved", async () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 40, { operation: "subtract", carryMode: "carry", digits: 3 });
    const task = tasks.find((t) => t.columns[0].borrowOut > 0 && t.columns[1].borrowOut > 0);
    expect(task).toBeDefined();

    mount(task, "always");
    await fillForm(task);

    // Solve phase just started: the units borrow step is active but its own
    // compare question hasn't been answered yet, and the tens borrow step
    // hasn't been reached at all — neither box may be visible yet. If either
    // is, its mere presence gives away "a borrow is needed here" before the
    // child has done any comparing.
    expect(container.querySelector('[data-cell-key="borrow:units"]')).toBeFalsy();
    expect(container.querySelector('[data-cell-key="borrow:tens"]')).toBeFalsy();

    tapCompareSign("<"); // resolve the units column's compare question

    // Now the units borrow box may appear (its own turn has come and its
    // compare is resolved), but the tens borrow box (a later column,
    // untouched) must still stay hidden.
    expect(container.querySelector('[data-cell-key="borrow:units"]')).toBeTruthy();
    expect(container.querySelector('[data-cell-key="borrow:tens"]')).toBeFalsy();
  });

  it("always: still shows the compare strip before a borrow step (existing behavior preserved)", async () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const task = tasks.find((t) => t.columns[0].borrowOut > 0);
    expect(task).toBeDefined();

    mount(task, "always");
    await fillForm(task);

    expect(container.querySelector(".col-compare-panel")).toBeTruthy();
    tapCompareSign("<");

    expect(container.querySelector(".col-compare-panel")).toBeFalsy();
    const borrowCell = container.querySelector('[data-cell-key="borrow:units"]');
    expect(borrowCell).toBeTruthy();
    expect(borrowCell.classList.contains("col-carry-cell--active")).toBe(true);
  });

  it("comparing an already-adjusted column highlights the yellow adjust box, not the crossed-out digit", async () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 60, { operation: "subtract", carryMode: "carry", digits: 3 });
    // topDigit >= 1 on the tens column sidesteps a separate, pre-existing
    // engine edge case (borrowing FROM a digit that's already 0 needs its
    // own further cascading borrow, which buildSubSteps doesn't model) —
    // out of scope here; this test is only about the highlight placement.
    const task = tasks.find((t) => t.columns[0].borrowOut > 0 && t.columns[1].borrowOut > 0 && t.columns[1].topDigit >= 1);
    expect(task).toBeDefined();
    const tensAdjustDigit = task.columns[1].topDigit - 1;

    mount(task, "always");
    await fillForm(task);

    // Resolve the units column's own compare question, then walk through its
    // full borrow ritual (borrow count, crossout gesture, adjusted digit,
    // result) — this is what leaves the tens column already crossed out and
    // adjusted by the time its own compare question comes up below.
    tapCompareSign("<");
    tapDigit(1); // borrow:units
    const crossoutBtn = container.querySelector(".col-crossout-gesture");
    expect(crossoutBtn, "crossout gesture button not found").toBeTruthy();
    act(() => crossoutBtn.click());
    tapDigit(tensAdjustDigit); // adjust:tens
    tapDigit(task.columns[0].writeDigit); // result:units

    // Now the tens column's own borrow question is active — tens is already
    // shown crossed out, with its reduced value sitting only in the yellow
    // "adjust" aux box (no duplicate badge on the digit itself). The
    // comparing highlight must land on that yellow box, not on the crossed-
    // out digit cell (which would draw the eye to the bigger, now-
    // irrelevant original digit instead of the number actually compared).
    expect(container.querySelector(".col-compare-panel")).toBeTruthy();
    const adjustBox = container.querySelector('[data-cell-key="adjust:tens"]');
    expect(adjustBox, "adjust aux box not found").toBeTruthy();
    expect(adjustBox.textContent.trim()).toBe(String(tensAdjustDigit));
    expect(adjustBox.classList.contains("col-carry-cell--comparing")).toBe(true);
    const tensDigitCell = container.querySelector(".col-digit--top-borrowed");
    expect(tensDigitCell, "crossed-out tens digit cell not found").toBeTruthy();
    expect(tensDigitCell.classList.contains("col-digit--comparing")).toBe(false);
  });

  it("onBorrow: does NOT show the compare strip on a no-borrow column (parity with pre-change default)", async () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 1, { operation: "subtract", carryMode: "none", digits: 2 });
    const task = tasks[0];

    mount(task, "onBorrow");
    await fillForm(task);

    expect(container.querySelector(".col-compare-panel")).toBeFalsy();
  });

  it("off: never shows the compare strip, even on a borrow column", async () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const task = tasks.find((t) => t.columns[0].borrowOut > 0);
    expect(task).toBeDefined();

    mount(task, "off");
    await fillForm(task);

    expect(container.querySelector(".col-compare-panel")).toBeFalsy();
    const borrowCell = container.querySelector('[data-cell-key="borrow:units"]');
    expect(borrowCell).toBeTruthy();
    expect(borrowCell.classList.contains("col-carry-cell--active")).toBe(true);
  });
});
