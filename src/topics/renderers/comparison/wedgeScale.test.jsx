import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import WedgeScale, { wedgeTicks, flagRows } from "./WedgeScale.jsx";

let container, root;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

function mount(props) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<WedgeScale {...props} />));
  const el = container.querySelector(".apply-wedge");
  // jsdom has no layout: give the wedge a 360px box so pointer x maps 1:1 to the viewBox.
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 130, right: 360, bottom: 130 });
  return el;
}
// jsdom's PointerEvent may be missing; a MouseEvent with the pointer type is what React listens for.
const pointer = (el, type, clientX) => act(() => {
  const e = new MouseEvent(type, { bubbles: true, clientX });
  Object.defineProperty(e, "pointerId", { value: 1 });
  el.dispatchEvent(e);
});
const xForRatio = (r) => 16 + r * (360 - 32);
const flags = () => [...container.querySelectorAll(".apply-wedge-flag text")].map((t) => Number(t.textContent)).sort((a, b) => a - b);
const shown = () => Number(container.querySelector(".apply-wedge-value").textContent);

describe("Сравнение — подсказка-клин", () => {
  it("ticks: every number up to 20, tens up to 99", () => {
    expect(wedgeTicks(1, 10)).toHaveLength(10);
    expect(wedgeTicks(1, 20).filter((t) => t.major).map((t) => t.value)).toEqual([1, 5, 10, 15, 20]);
    expect(wedgeTicks(10, 99).map((t) => t.value)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it("flags of close numbers stack into rows", () => {
    expect(flagRows([100, 110, 200, 120])).toEqual([0, 1, 0, 2]);
  });

  it("starts at the small end and the number grows with the value", () => {
    const el = mount({ min: 10, max: 99, direction: "asc", numbers: [] });
    expect(shown()).toBe(10);
    const small = Number(container.querySelector(".apply-wedge-value").getAttribute("font-size"));
    pointer(el, "pointerdown", xForRatio(1));
    expect(shown()).toBe(99);
    expect(Number(container.querySelector(".apply-wedge-value").getAttribute("font-size"))).toBeGreaterThan(small * 2);
  });

  it("«от большего к меньшему»: the big end is on the left", () => {
    const el = mount({ min: 10, max: 99, direction: "desc", numbers: [] });
    expect(shown()).toBe(99);
    pointer(el, "pointerdown", xForRatio(1));
    expect(shown()).toBe(10);
  });

  it("every task number the slider passed gets a flag, even when the finger skipped it", () => {
    const el = mount({ min: 10, max: 99, direction: "asc", numbers: [34, 61, 35, 90] });
    pointer(el, "pointerdown", xForRatio(0));
    pointer(el, "pointermove", xForRatio(0.7)); // one jump 10 → 72: 34, 35 and 61 were passed
    expect(flags()).toEqual([34, 35, 61]);
    pointer(el, "pointerup", xForRatio(0.7));
    pointer(el, "pointermove", xForRatio(1));   // not dragging: nothing moves
    expect(flags()).toEqual([34, 35, 61]);
  });
});
