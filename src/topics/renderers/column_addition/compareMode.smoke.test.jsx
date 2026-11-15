import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import ColumnAdditionRenderer from "./index.jsx";
import { columnTaskOfExample } from "./engine.js";

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

  const answer = (label) => tapCompareSign(label);
  const crossOut = () => {
    const btn = container.querySelector(".col-crossout-gesture");
    expect(btn, "crossout gesture not found").toBeTruthy();
    act(() => btn.click());
  };
  const question = () => container.querySelector(".col-compare-panel-q")?.textContent.replace(/\s+/g, " ").trim();

  it("always: «хватает?» on a place that needs no borrow, then the result", async () => {
    const task = columnTaskOfExample({ operation: "subtract", top: 58, bottom: 23 });
    mount(task, "always");
    await fillForm(task);

    expect(question()).toBe("8 − 3: единиц хватает?");
    answer("Не хватает"); // wrong — shakes, the question stays
    expect(container.querySelector(".col-compare-panel")).toBeTruthy();
    answer("Хватает");
    expect(container.querySelector(".col-compare-panel")).toBeFalsy();
    tapDigit(5);
    expect(container.querySelector('[data-cell-key="result:units"]').classList.contains("col-result-cell--filled")).toBe(true);
    expect(question()).toBe("5 − 2: десятков хватает?");
  });

  it("nothing of the borrow shows before «Не хватает» is answered", async () => {
    const task = columnTaskOfExample({ operation: "subtract", top: 532, bottom: 157 });
    mount(task, "always");
    await fillForm(task);

    expect(container.querySelector(".col-crossout-gesture")).toBeFalsy();
    expect(container.querySelector('[data-cell-key="borrow:units"]')).toBeFalsy();
    answer("Не хватает");
    expect(container.querySelector(".col-crossout-gesture")).toBeTruthy();
  });

  it("532 − 157: the tens keep their «2» and get a «1» in front of it — 12, nothing overwritten", async () => {
    const task = columnTaskOfExample({ operation: "subtract", top: 532, bottom: 157 });
    mount(task, "always");
    await fillForm(task);

    answer("Не хватает");
    crossOut(); // the 3 of the tens
    tapDigit(2); // adjust:tens — over the crossed-out 3
    tapDigit(1); // borrow:units — in front of the 2 of the units
    expect(container.querySelector('[data-cell-key="borrow:units"]').closest(".col-digit")).toBeTruthy();
    tapDigit(5); // 12 − 7

    expect(question()).toBe("2 − 5: десятков хватает?");
    // the mark over the tens is what is compared now, not the crossed-out 3
    expect(container.querySelector(".col-mark-cell--comparing")).toBeTruthy();
    answer("Не хватает");
    crossOut(); // the 5 of the hundreds
    tapDigit(4);
    tapDigit(1); // borrow:tens — in front of the mark «2»
    const tensMark = container.querySelector('[data-cell-key="adjust:tens"]').closest(".col-mark-cell");
    expect(tensMark.textContent.replace(/\s+/g, "")).toBe("12");
    tapDigit(7); // 12 − 5

    expect(question()).toBe("4 − 1: сотен хватает?");
    answer("Хватает");
    tapDigit(3);
    expect(container.querySelectorAll(".col-result-cell--filled")).toHaveLength(3);
  });

  it("onBorrow: asks only on a place that has to borrow", async () => {
    const task = columnTaskOfExample({ operation: "subtract", top: 352, bottom: 127 });
    mount(task, "onBorrow");
    await fillForm(task);

    expect(question()).toBe("2 − 7: единиц хватает?");
    answer("Не хватает");
    crossOut(); tapDigit(4); tapDigit(1); tapDigit(5);
    expect(container.querySelector(".col-compare-panel")).toBeFalsy(); // 4 − 2: no question
  });

  it("off: never asks — straight to crossing out", async () => {
    const task = columnTaskOfExample({ operation: "subtract", top: 52, bottom: 27 });
    mount(task, "off");
    await fillForm(task);

    expect(container.querySelector(".col-compare-panel")).toBeFalsy();
    expect(container.querySelector(".col-crossout-gesture")).toBeTruthy();
  });

  it("95 + 7: the new place's «1» is the child's to write, not shown ready", async () => {
    const task = columnTaskOfExample({ operation: "add", top: 95, bottom: 7 });
    mount(task, "always");
    await fillForm(task);

    expect(container.querySelector(".col-compare-panel")).toBeFalsy(); // addition: no question
    expect(container.querySelector('[data-cell-key="result:overflow"]')).toBeFalsy(); // not given away early
    tapDigit(2); tapDigit(1); tapDigit(0);
    const overflow = container.querySelector('[data-cell-key="result:overflow"]');
    expect(overflow.textContent.trim()).toBe("");
    expect(overflow.classList.contains("col-result-cell--active")).toBe(true);
    tapDigit(1);
    expect(overflow.textContent.trim()).toBe("1");
  });
});
