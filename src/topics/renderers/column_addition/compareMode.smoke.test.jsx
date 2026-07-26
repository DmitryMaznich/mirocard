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
    // No corner mark exists for this column — the strip is the new "always" branch.
    expect(container.querySelector('[data-cell-key="corner:units"]')).toBeFalsy();

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

    // Solve phase just started: the units corner mark is active but its own
    // compare question hasn't been answered yet, and the tens corner mark
    // hasn't been reached at all — neither may be visible yet. If either is,
    // its mere presence gives away "a borrow is needed here" before the
    // child has done any comparing.
    expect(container.querySelector('[data-cell-key="corner:units"]')).toBeFalsy();
    expect(container.querySelector('[data-cell-key="corner:tens"]')).toBeFalsy();

    tapCompareSign("<"); // resolve the units column's compare question

    // Now the units corner mark may appear (its own turn has come and its
    // compare is resolved), but the tens corner mark (a later column,
    // untouched) must still stay hidden.
    expect(container.querySelector('[data-cell-key="corner:units"]')).toBeTruthy();
    expect(container.querySelector('[data-cell-key="corner:tens"]')).toBeFalsy();
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
    const corner = container.querySelector('[data-cell-key="corner:units"]');
    expect(corner).toBeTruthy();
    expect(corner.classList.contains("col-digit-corner--active")).toBe(true);
  });

  it("cascading borrow: the corner mark updates from the adjusted digit to the new borrow digit", async () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 60, { operation: "subtract", carryMode: "carry", digits: 3 });
    // topDigit >= 1 on the tens column sidesteps a separate, pre-existing
    // engine edge case (borrowing FROM a digit that's already 0 needs its
    // own further cascading borrow, which buildSubSteps doesn't model) —
    // out of scope here; this test is only about the corner-mark display.
    const task = tasks.find((t) => t.columns[0].borrowOut > 0 && t.columns[1].borrowOut > 0 && t.columns[1].topDigit >= 1);
    expect(task).toBeDefined();
    const tensAdjustDigit = task.columns[1].topDigit - 1;

    mount(task, "always");
    await fillForm(task);

    // Resolve the units column's own compare question, then walk through its
    // full borrow ritual: borrow count, THEN the units result (the current
    // column is finished first), and only then crossout + adjust on tens —
    // this is what leaves the tens column already crossed out and adjusted
    // by the time its own compare question comes up below.
    tapCompareSign("<");
    tapDigit(1); // borrow:units
    tapDigit(task.columns[0].writeDigit); // result:units
    const crossoutBtn = container.querySelector(".col-crossout-gesture");
    expect(crossoutBtn, "crossout gesture button not found").toBeTruthy();
    act(() => crossoutBtn.click());
    tapDigit(tensAdjustDigit); // adjust:tens

    // Tens is now crossed out, corner mark shows the adjusted digit — no
    // separate row, no duplicate badge, just this one corner on the cell.
    let corner = container.querySelector('[data-cell-key="corner:tens"]');
    expect(corner, "tens corner mark not found").toBeTruthy();
    expect(corner.textContent.trim()).toBe(String(tensAdjustDigit));
    expect(corner.classList.contains("col-digit-corner--filled")).toBe(true);

    // Now the tens column's own borrow question is active — the compare
    // panel refers to exactly this adjusted value, so while it's pending the
    // corner keeps showing it (highlighted purple), not the crossed-out
    // original digit underneath.
    expect(container.querySelector(".col-compare-panel")).toBeTruthy();
    corner = container.querySelector('[data-cell-key="corner:tens"]');
    expect(corner.textContent.trim()).toBe(String(tensAdjustDigit));
    expect(corner.classList.contains("col-digit-corner--comparing")).toBe(true);
    const tensDigitCell = container.querySelector(".col-digit--top-borrowed");
    expect(tensDigitCell, "crossed-out tens digit cell not found").toBeTruthy();
    expect(tensDigitCell.classList.contains("col-digit--comparing")).toBe(false);

    // Resolve tens' own compare and type its borrow digit — the corner must
    // now show "1" instead, overwriting the adjusted "4".
    tapCompareSign("<");
    corner = container.querySelector('[data-cell-key="corner:tens"]');
    expect(corner.classList.contains("col-digit-corner--active")).toBe(true);
    tapDigit(1); // borrow:tens
    corner = container.querySelector('[data-cell-key="corner:tens"]');
    expect(corner.textContent.trim()).toBe("1");
    expect(corner.classList.contains("col-digit-corner--filled")).toBe(true);
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
    const corner = container.querySelector('[data-cell-key="corner:units"]');
    expect(corner).toBeTruthy();
    expect(corner.classList.contains("col-digit-corner--active")).toBe(true);
  });
});
